import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { seedSavedMethods } from '../src/services/deps.js'
import { PUBLISHABLE_KEY, testConfig } from './helpers.js'

const databaseUrl = process.env.DATABASE_URL
const CARD = { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' }

describe.skipIf(!databaseUrl)('postgres endpoint families', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp(testConfig({ store: 'postgres', databaseUrl, tokenRateLimitMax: 10_000, rateLimitMax: 10_000 }))
    await app.deps.repo.resetBusinessData()
    await seedSavedMethods(app.deps)
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

  it('payment_intents: create, update, decline, idempotency conflict, and cancel', async () => {
    const created = await call('POST', '/v1/payment_intents', { amount: 4100, currency: 'CNY', description: 'family-pi' })
    expect(created.statusCode).toBe(200)
    const intent = created.json().payment_intent as { id: string; client_secret: string }
    const updated = await call('POST', `/v1/payment_intents/${intent.id}`, { amount: 4200, description: 'family-pi-2' })
    expect(updated.json().payment_intent.amount).toBe(4200)
    const declineToken = await call('POST', '/v1/tokens', { card: { ...CARD, number: '4000000000000002' } })
    const declined = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: declineToken.json().token }, {
      'x-nexus-client-secret': intent.client_secret,
      'idempotency-key': 'pg-family-decline',
    })
    expect(declined.statusCode).toBe(402)
    const conflict = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: 'other' }, {
      'x-nexus-client-secret': intent.client_secret,
      'idempotency-key': 'pg-family-decline',
    })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('idempotency_key_in_use')
    const canceled = await call('POST', `/v1/payment_intents/${intent.id}/cancel`, {})
    expect(canceled.json().payment_intent.status).toBe('canceled')
    const stored = await app.deps.repo.findPaymentIntentById(intent.id)
    expect(stored?.status).toBe('canceled')
    expect(stored?.description).toBe('family-pi-2')
  })

  it('setup_intents: confirm a card, list it, and reject a second confirm', async () => {
    const created = await call('POST', '/v1/setup_intents', { usage: 'off_session', customer_email: 'db@example.com' })
    const setup = created.json().setup_intent as { client_secret: string; id: string }
    const token = await call('POST', '/v1/tokens', { card: { ...CARD, number: '5555555555554444' } })
    const confirmed = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: token.json().token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(confirmed.statusCode).toBe(200)
    expect(confirmed.json().payment_method.card.brand).toBe('mastercard')
    const again = await call('POST', '/v1/setup_intents/confirm', { payment_method_token: token.json().token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(again.statusCode).toBe(409)
    const methods = await call('GET', '/v1/payment_methods')
    const ids = methods.json().data.map((entry: { id: string }) => entry.id)
    expect(ids).toContain('pm_saved_1')
    expect(ids).toContain(confirmed.json().setup_intent.payment_method)
  })

  it('checkout sessions: wrong secret, success, and a closed session', async () => {
    const created = await call('POST', '/v1/checkout/sessions', {
      amount: 12900,
      currency: 'cny',
      ui_mode: 'embedded',
      line_items: [{ name: 'Pro', amount: 12900, quantity: 1 }],
      success_url: 'https://merchant.test/ok?session_id={SESSION_ID}',
    })
    const session = created.json().checkout_session as { id: string; client_secret: string }
    const denied = await call('GET', `/v1/checkout/sessions/${session.id}`, undefined, { 'x-nexus-client-secret': 'wrong' })
    expect(denied.statusCode).toBe(401)
    const token = await call('POST', '/v1/tokens', { card: CARD })
    const paid = await call('POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: token.json().token }, { 'x-nexus-client-secret': session.client_secret })
    expect(paid.json().checkout_session.status).toBe('complete')
    const closed = await call('POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: token.json().token }, { 'x-nexus-client-secret': session.client_secret })
    expect(closed.statusCode).toBe(409)
    const row = await app.deps.repo.findCheckoutSessionById(session.id)
    expect(row?.paymentIntent).toMatch(/^pi_test_/)
  })

  it('3DS: challenge, failure, then a successful card on the same intent', async () => {
    const created = await call('POST', '/v1/payment_intents', { amount: 3220, currency: 'usd' })
    const intent = created.json().payment_intent as { id: string; client_secret: string }
    const challenge = await call('POST', '/v1/tokens', { card: { ...CARD, number: '4000000000003220' } })
    const challenged = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: challenge.json().token, return_url: '/return' }, { 'x-nexus-client-secret': intent.client_secret })
    expect(challenged.json().payment_intent.status).toBe('requires_action')
    const failed = await call('POST', '/v1/3ds/complete', { intent: intent.id, status: 'failed' })
    expect(failed.json()).toEqual({ ok: true })
    const good = await call('POST', '/v1/tokens', { card: CARD })
    const paid = await call('POST', '/v1/payment_intents/confirm', { payment_method_token: good.json().token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(paid.json().payment_intent.status).toBe('succeeded')
    const events = await app.deps.repo.listWebhookEvents(app.deps.config.accountId)
    expect(events.some((event) => event.type === 'payment_intent.requires_action')).toBe(true)
    expect(events.some((event) => event.type === 'payment_intent.payment_failed')).toBe(true)
    expect(events.some((event) => event.type === 'payment_intent.succeeded')).toBe(true)
  })

  it('payment_methods: returns the seeded saved cards', async () => {
    const response = await call('GET', '/v1/payment_methods')
    expect(response.statusCode).toBe(200)
    const cards = response.json().data as Array<{ id: string; card: { last4: string } }>
    expect(cards.find((entry) => entry.id === 'pm_saved_1')?.card.last4).toBe('4242')
    expect(cards.find((entry) => entry.id === 'pm_saved_2')?.card.last4).toBe('4444')
  })

  it('orders: upsert, read, and a missing id', async () => {
    const saved = await call('POST', '/v1/orders/ord_pg_family', { status: 'shipped', items: [{ name: 'Box' }] })
    expect(saved.statusCode).toBe(200)
    const loaded = await call('GET', '/v1/orders/ord_pg_family')
    expect(loaded.json().order.status).toBe('shipped')
    const missing = await call('GET', '/v1/orders/ord_pg_missing')
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error.code).toBe('resource_missing')
  })

  it('CORS allowlist and token rate limit still apply on Postgres', async () => {
    const limited = await buildApp(testConfig({
      store: 'postgres',
      databaseUrl,
      tokenRateLimitMax: 2,
      rateLimitMax: 100,
      corsOrigins: ['http://localhost:3000'],
    }))
    try {
      const headers = { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, origin: 'http://localhost:3000' }
      expect((await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'fpx', fpx: { bank: 'maybank2u' } }, headers })).statusCode).toBe(200)
      expect((await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'fpx', fpx: { bank: 'maybank2u' } }, headers })).statusCode).toBe(200)
      const blocked = await limited.inject({ method: 'POST', url: '/v1/tokens', payload: { payment_method_type: 'fpx', fpx: { bank: 'maybank2u' } }, headers })
      expect(blocked.statusCode).toBe(429)
      expect(blocked.json().error.code).toBe('rate_limited')
      expect(blocked.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      const denied = await limited.inject({
        method: 'GET',
        url: '/v1/payment_methods',
        headers: { origin: 'https://evil.example', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      expect(denied.statusCode).toBe(200)
      expect(denied.headers['access-control-allow-origin']).toBeUndefined()
    } finally {
      await limited.close()
    }
  })
})
