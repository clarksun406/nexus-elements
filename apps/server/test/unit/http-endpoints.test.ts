import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { buildApp } from '../../src/app.js'
import { ManualClock, PUBLISHABLE_KEY, SECRET_KEY, testConfig } from '../helpers.js'

const CARD = { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' }

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp(testConfig())
})

afterAll(async () => {
  await app.close()
})

function call(method: 'GET' | 'POST', url: string, payload?: unknown, headers?: Record<string, string>) {
  return app.inject({
    method,
    url,
    payload,
    headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, ...headers },
  })
}

function errorOf(response: LightMyRequestResponse) {
  return response.json().error as { type: string; code: string; message: string; decline_code?: string; payment_intent?: { status?: string } }
}

async function createIntent(amount = 100) {
  const response = await call('POST', '/v1/payment_intents', { amount, currency: 'cny' })
  expect(response.statusCode).toBe(200)
  return response.json().payment_intent as { id: string; client_secret: string; status: string }
}

async function createToken(number = CARD.number) {
  const response = await call('POST', '/v1/tokens', { card: { ...CARD, number } })
  expect(response.statusCode).toBe(200)
  return response.json() as { token: string; payment_method_id: string }
}

describe('token validation', () => {
  it('returns a validation_error envelope for an empty card', async () => {
    const response = await call('POST', '/v1/tokens', { card: {} })
    expect(response.statusCode).toBe(400)
    expect(errorOf(response)).toMatchObject({ type: 'validation_error', code: 'invalid_number' })
  })

  it('rejects a PAN that fails Luhn', async () => {
    const response = await call('POST', '/v1/tokens', { card: { ...CARD, number: '4242424242424243' } })
    expect(errorOf(response).code).toBe('invalid_number')
    expect(errorOf(response).message).toContain('无效')
  })

  it('rejects a card missing the CVC', async () => {
    const response = await call('POST', '/v1/tokens', { card: { number: CARD.number, exp_month: 12, exp_year: 2035 } })
    expect(errorOf(response).code).toBe('incomplete_card')
  })

  it('rejects an expiry in the past', async () => {
    const response = await call('POST', '/v1/tokens', { card: { ...CARD, exp_month: 1, exp_year: 2020 } })
    expect(errorOf(response).code).toBe('invalid_expiry')
  })

  it('does not echo the PAN', async () => {
    const response = await call('POST', '/v1/tokens', { card: CARD })
    expect(JSON.stringify(response.json())).not.toContain(CARD.number)
    expect(response.json().card.last4).toBe('4242')
  })

  it('tokenizes a non-card method', async () => {
    const response = await call('POST', '/v1/tokens', { payment_method_type: 'ideal', ideal: { bank: 'ing' } })
    expect(response.statusCode).toBe(200)
    expect(response.json().type).toBe('ideal')
  })

  it('rejects an encrypted payload that is not an object', async () => {
    const response = await call('POST', '/v1/tokens', { encrypted_card: 'nope' })
    expect(errorOf(response).code).toBe('decryption_failed')
  })

  it('rejects an encrypted payload that will not decrypt', async () => {
    const response = await call('POST', '/v1/tokens', { encrypted_card: { key_id: 'ek_test_rsa_oaep', ek: 'aa', iv: 'bb', ciphertext: 'cc' } })
    expect(response.statusCode).toBe(400)
    expect(errorOf(response).code).toBe('decryption_failed')
  })
})

describe('token expiry and reuse', () => {
  it('rejects an expired token and a second use of a fresh token', async () => {
    const clock = new ManualClock()
    const timed = await buildApp(testConfig(), { clock })
    try {
      const intent = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents',
        payload: { amount: 100 },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const secret = intent.json().payment_intent.client_secret as string
      const first = await timed.inject({
        method: 'POST',
        url: '/v1/tokens',
        payload: { card: CARD },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      clock.advance(6 * 60 * 1000)
      const expired = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents/confirm',
        payload: { payment_method_token: first.json().token },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': secret },
      })
      expect(expired.json().error.code).toBe('token_expired')
      clock.advance(-6 * 60 * 1000)
      const fresh = await timed.inject({
        method: 'POST',
        url: '/v1/tokens',
        payload: { card: CARD },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const ok = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents/confirm',
        payload: { payment_method_token: fresh.json().token },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': secret },
      })
      expect(ok.statusCode).toBe(200)
      const other = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents',
        payload: { amount: 100 },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const reused = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents/confirm',
        payload: { payment_method_token: fresh.json().payment_method_id },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': other.json().payment_intent.client_secret },
      })
      expect(reused.json().error.code).toBe('token_already_used')
    } finally {
      await timed.close()
    }
  })
})

describe('payment intent routes', () => {
  it('rejects a non-positive amount with the validation envelope', async () => {
    for (const amount of [0, -5, 1.5]) {
      const response = await call('POST', '/v1/payment_intents', { amount })
      expect(response.statusCode).toBe(400)
      expect(errorOf(response)).toMatchObject({ type: 'validation_error', code: 'invalid_amount' })
    }
  })

  it('lowercases currency and stores a manual capture method', async () => {
    const response = await call('POST', '/v1/payment_intents', { amount: 250, currency: 'USD', capture_method: 'manual', metadata: { order: '1' } })
    expect(response.json().payment_intent.currency).toBe('usd')
    expect(response.json().payment_intent.capture_method).toBe('manual')
    expect(response.json().payment_intent.metadata).toEqual({ order: '1' })
  })

  it('defaults currency to cny', async () => {
    const response = await call('POST', '/v1/payment_intents', { amount: 10 })
    expect(response.json().payment_intent.currency).toBe('cny')
    expect(response.json().payment_intent.status).toBe('requires_payment_method')
  })

  it('returns 404 when confirm has no client secret', async () => {
    const response = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: 'tok_test_1' })
    expect(response.statusCode).toBe(404)
    expect(errorOf(response).code).toBe('resource_missing')
  })

  it('returns a card_error envelope for a declined test card', async () => {
    const intent = await createIntent(80)
    const token = await createToken('4000000000009995')
    const response = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: token.token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(response.statusCode).toBe(402)
    expect(errorOf(response)).toMatchObject({
      type: 'card_error',
      code: 'card_declined',
      decline_code: 'insufficient_funds',
      payment_intent: { status: 'requires_payment_method' },
    })
  })

  it('confirms a saved payment method', async () => {
    const intent = await createIntent(90)
    const response = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: 'pm_saved_2' }, { 'x-nexus-client-secret': intent.client_secret })
    expect(response.json().payment_intent.payment_method).toBe('pm_saved_2')
    expect(response.json().payment_intent.status).toBe('succeeded')
  })

  it('rejects an unknown saved payment method', async () => {
    const intent = await createIntent(91)
    const response = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: 'pm_saved_missing' }, { 'x-nexus-client-secret': intent.client_secret })
    expect(errorOf(response).code).toBe('invalid_token')
  })

  it('updates whitelisted fields and ignores unknown ones', async () => {
    const intent = await createIntent(100)
    const response = await call('POST', `/v1/payment_intents/${intent.id}`, {
      amount: 180,
      description: 'next',
      receipt_email: 'a@b.c',
      payment_method_types: ['card'],
      not_a_field: 'ignored',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().payment_intent.amount).toBe(180)
    expect(response.json().payment_intent.description).toBe('next')
    expect(response.json().payment_intent.not_a_field).toBeUndefined()
  })

  it('rejects an amount change after success and still allows the description', async () => {
    const intent = await createIntent(110)
    await call('POST', '/v1/payment_intents/confirm', { payment_method_token: (await createToken()).token }, { 'x-nexus-client-secret': intent.client_secret })
    const blocked = await call('POST', `/v1/payment_intents/${intent.id}`, { amount: 999 })
    expect(blocked.statusCode).toBe(409)
    expect(errorOf(blocked).code).toBe('payment_intent_unexpected_state')
    const described = await call('POST', `/v1/payment_intents/${intent.id}`, { description: 'after' })
    expect(described.statusCode).toBe(200)
  })

  it('rejects an invalid amount update', async () => {
    const intent = await createIntent(120)
    const response = await call('POST', `/v1/payment_intents/${intent.id}`, { amount: -1 })
    expect(errorOf(response).code).toBe('invalid_amount')
  })

  it('cancels an open intent and refuses to cancel a succeeded one', async () => {
    const open = await createIntent(130)
    const canceled = await call('POST', `/v1/payment_intents/${open.id}/cancel`, {})
    expect(canceled.json().payment_intent.status).toBe('canceled')
    const paid = await createIntent(131)
    await call('POST', '/v1/payment_intents/confirm', { payment_method_token: (await createToken()).token }, { 'x-nexus-client-secret': paid.client_secret })
    const refused = await call('POST', `/v1/payment_intents/${paid.id}/cancel`, {})
    expect(refused.statusCode).toBe(409)
  })

  it('refuses to confirm a canceled intent', async () => {
    const intent = await createIntent(140)
    await call('POST', `/v1/payment_intents/${intent.id}/cancel`, {})
    const response = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: (await createToken()).token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(response.statusCode).toBe(409)
    expect(errorOf(response).code).toBe('payment_intent_unexpected_state')
  })

  it('returns 404 when updating an unknown intent', async () => {
    const response = await call('POST', '/v1/payment_intents/pi_test_99999', { description: 'nope' })
    expect(response.statusCode).toBe(404)
    expect(errorOf(response).type).toBe('api_error')
  })
})

describe('idempotent confirm', () => {
  it('replays the first response and conflicts on a different body', async () => {
    const intent = await createIntent(150)
    const token = await createToken()
    const headers = { 'x-nexus-client-secret': intent.client_secret, 'idempotency-key': `idem-${intent.id}` }
    const first = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: token.token }, headers)
    expect(first.statusCode).toBe(200)
    const replay = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: token.token }, headers)
    expect(replay.json().payment_intent.status).toBe('succeeded')
    const conflict = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: 'other' }, headers)
    expect(conflict.statusCode).toBe(409)
    expect(errorOf(conflict).code).toBe('idempotency_key_in_use')
  })
})

describe('setup intent routes', () => {
  it('defaults usage to off_session', async () => {
    const response = await call('POST', '/v1/setup_intents', {})
    expect(response.json().setup_intent.usage).toBe('off_session')
    expect(response.json().setup_intent.status).toBe('requires_payment_method')
  })

  it('returns 404 for a missing client secret', async () => {
    const response = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: 'tok_missing' })
    expect(response.statusCode).toBe(404)
    expect(errorOf(response).code).toBe('resource_missing')
  })

  it('saves a card and then rejects a second confirm', async () => {
    const setup = (await call('POST', '/v1/setup_intents', { usage: 'on_session', customer_email: 'a@example.com' })).json().setup_intent
    const token = await createToken('5555555555554444')
    const confirmed = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: token.token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(confirmed.statusCode).toBe(200)
    expect(confirmed.json().setup_intent.status).toBe('succeeded')
    expect(confirmed.json().payment_method.card.last4).toBe('4444')
    const again = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: token.token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(again.statusCode).toBe(409)
    expect(errorOf(again).code).toBe('setup_intent_already_confirmed')
  })

  it('returns a card_error when the setup card is declined', async () => {
    const setup = (await call('POST', '/v1/setup_intents', {})).json().setup_intent
    const token = await createToken('4000000000000002')
    const response = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: token.token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(response.statusCode).toBe(402)
    expect(errorOf(response).decline_code).toBe('generic_decline')
  })
})

describe('checkout routes', () => {
  it('rejects a bad amount', async () => {
    const response = await call('POST', '/v1/checkout/sessions', { amount: 0 })
    expect(errorOf(response).code).toBe('invalid_amount')
  })

  it('requires the client secret to read a session', async () => {
    const created = await call('POST', '/v1/checkout/sessions', { amount: 500, currency: 'eur', ui_mode: 'redirect', success_url: 'https://ok/{SESSION_ID}' })
    const session = created.json().checkout_session
    expect(session.url).toContain(session.id)
    const missing = await call('GET', `/v1/checkout/sessions/${session.id}`)
    expect(missing.statusCode).toBe(401)
    expect(errorOf(missing).code).toBe('invalid_client_secret')
    const loaded = await call('GET', `/v1/checkout/sessions/${session.id}`, undefined, { 'x-nexus-client-secret': session.client_secret })
    expect(loaded.statusCode).toBe(200)
  })

  it('returns 404 for an unknown session', async () => {
    const response = await call('GET', '/v1/checkout/sessions/cs_test_404', undefined, { 'x-nexus-client-secret': 'nope' })
    expect(response.statusCode).toBe(404)
  })

  it('completes a session and then refuses another confirm', async () => {
    const session = (await call('POST', '/v1/checkout/sessions', { amount: 600, line_items: [{ name: 'A', amount: 600, quantity: 1 }] })).json().checkout_session
    const token = await createToken()
    const paid = await call('POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: token.token }, { 'x-nexus-client-secret': session.client_secret })
    expect(paid.json().checkout_session.status).toBe('complete')
    expect(paid.json().checkout_session.payment_intent).toMatch(/^pi_test_/)
    const again = await call('POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: (await createToken()).token }, { 'x-nexus-client-secret': session.client_secret })
    expect(again.statusCode).toBe(409)
    expect(errorOf(again).code).toBe('session_not_open')
  })
})

describe('3DS, orders, methods, and apple pay', () => {
  it('moves a challenge to failed and then lets a new card succeed', async () => {
    const intent = await createIntent(700)
    const challengeToken = await createToken('4000000000003220')
    const challenged = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: challengeToken.token, return_url: '/back' }, { 'x-nexus-client-secret': intent.client_secret })
    expect(challenged.json().payment_intent.status).toBe('requires_action')
    expect(challenged.json().next_action.redirect_url).toContain('/3ds-mock')
    const failed = await call('POST', '/v1/3ds/complete', { intent: intent.id, status: 'failed' })
    expect(failed.json()).toEqual({ ok: true })
    const paid = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: (await createToken()).token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(paid.json().payment_intent.status).toBe('succeeded')
  })

  it('returns ok for a 3DS completion that does not match an open challenge', async () => {
    const response = await call('POST', '/v1/3ds/complete', { intent: 'pi_test_missing', status: 'approved' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })

  it('serves the challenge page without framing the API', async () => {
    const page = await app.inject({ method: 'GET', url: '/3ds-mock?intent=pi_test_1&return_url=/' })
    expect(page.body).toContain('验证通过')
    expect(page.headers['x-frame-options']).toBeUndefined()
    const api = await call('GET', '/v1/encryption_key')
    expect(api.json().algorithm).toBe('RSA-OAEP')
    expect(api.headers['x-frame-options']).toBe('DENY')
  })

  it('upserts and reads an order, and 404s when it is missing', async () => {
    const saved = await call('POST', '/v1/orders/ord_unit', { status: 'paid', items: [{ name: 'A' }] })
    expect(saved.json().order.status).toBe('paid')
    const loaded = await call('GET', '/v1/orders/ord_unit')
    expect(loaded.json().order.items).toEqual([{ name: 'A' }])
    const missing = await call('GET', '/v1/orders/ord_missing')
    expect(missing.statusCode).toBe(404)
    expect(errorOf(missing)).toMatchObject({ type: 'api_error', code: 'resource_missing' })
  })

  it('lists the seeded saved payment methods', async () => {
    const response = await call('GET', '/v1/payment_methods')
    const ids = response.json().data.map((entry: { id: string }) => entry.id)
    expect(ids).toEqual(expect.arrayContaining(['pm_saved_1', 'pm_saved_2']))
  })

  it('reports apple pay as unavailable', async () => {
    const response = await call('POST', '/v1/apple_pay/sessions', { validation_url: 'https://apple.test' })
    expect(response.statusCode).toBe(501)
    expect(errorOf(response).code).toBe('apple_pay_unavailable')
  })
})

describe('auth and transport envelopes', () => {
  it('returns 401 when the key is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/payment_intents', payload: { amount: 1 }, headers: { 'content-type': 'application/json' } })
    expect(response.statusCode).toBe(401)
    expect(errorOf(response)).toMatchObject({ type: 'api_error', code: 'invalid_api_key' })
  })

  it('returns 403 for the wrong account', async () => {
    const response = await call('GET', '/v1/payment_methods', undefined, { 'x-nexus-account': 'acct_other' })
    expect(response.statusCode).toBe(403)
    expect(errorOf(response).code).toBe('account_invalid')
  })

  it('creates an intent with the secret key when publishable creates are disabled', async () => {
    const locked = await buildApp(testConfig({ allowPublishableCreates: false }))
    try {
      const denied = await locked.inject({
        method: 'POST',
        url: '/v1/payment_intents',
        payload: { amount: 10 },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      expect(denied.json().error.code).toBe('publishable_key_not_allowed')
      const created = await locked.inject({
        method: 'POST',
        url: '/v1/setup_intents',
        payload: {},
        headers: { 'content-type': 'application/json', authorization: `Bearer ${SECRET_KEY}` },
      })
      expect(created.statusCode).toBe(200)
    } finally {
      await locked.close()
    }
  })

  it('issues live-mode ids for a live key pair', async () => {
    const live = await buildApp(testConfig({
      publishableKey: 'pk_live_merchant',
      secretKey: 'sk_live_merchant',
      mode: 'live',
    }))
    try {
      const response = await live.inject({
        method: 'POST',
        url: '/v1/payment_intents',
        payload: { amount: 10 },
        headers: { 'content-type': 'application/json', 'x-nexus-key': 'pk_live_merchant' },
      })
      expect(response.json().payment_intent.id).toMatch(/^pi_live_/)
    } finally {
      await live.close()
    }
  })

  it('rejects invalid JSON and a non-object body', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/tokens',
      payload: '{',
      headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
    })
    expect(invalid.statusCode).toBe(400)
    expect(errorOf(invalid).code).toBe('invalid_json')
    const array = await app.inject({
      method: 'POST',
      url: '/v1/tokens',
      payload: '[1]',
      headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
    })
    expect(array.statusCode).toBe(400)
    expect(errorOf(array).code).toBe('invalid_request')
  })

  it('hides internal errors behind the api_error envelope', async () => {
    const original = app.deps.repo.insertPaymentIntent.bind(app.deps.repo)
    app.deps.repo.insertPaymentIntent = async () => {
      throw new Error('relation missing')
    }
    try {
      const response = await call('POST', '/v1/payment_intents', { amount: 10 })
      expect(response.statusCode).toBe(500)
      expect(errorOf(response)).toEqual({ type: 'api_error', code: 'internal_error', message: '服务器内部错误。' })
      expect(response.body).not.toContain('relation missing')
    } finally {
      app.deps.repo.insertPaymentIntent = original
    }
  })

  it('returns the unknown-endpoint envelope', async () => {
    const response = await call('GET', '/v1/does-not-exist')
    expect(response.statusCode).toBe(404)
    expect(errorOf(response).message).toBe('未知接口: GET /does-not-exist')
  })

  it('does not require a key for health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.json()).toEqual({ status: 'ok', store: 'memory' })
  })

  it('rate limits tokenization and only reflects an allowlisted origin', async () => {
    const limited = await buildApp(testConfig({ rateLimitMax: 50, tokenRateLimitMax: 2, corsOrigins: ['http://localhost:3000'] }))
    try {
      const headers = { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY }
      expect((await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'ideal' }, headers })).statusCode).toBe(200)
      expect((await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'ideal' }, headers })).statusCode).toBe(200)
      const blocked = await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'ideal' }, headers })
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json().error.code).toBe('rate_limited')
      const allowed = await limited.inject({
        method: 'OPTIONS',
        url: '/v1/tokens',
        headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'POST' },
      })
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      const denied = await limited.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'https://evil.example' },
      })
      expect(denied.headers['access-control-allow-origin']).toBeUndefined()
    } finally {
      await limited.close()
    }
  })
})
