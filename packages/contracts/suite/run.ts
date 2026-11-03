import { expect, it } from 'vitest'

export const CONTRACT_PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

interface ErrorBody {
  error: { type: string; code?: string; message: string; decline_code?: string; payment_intent?: { status?: string } }
}

interface IntentBody {
  payment_intent: { id: string; status: string; client_secret: string; currency: string; amount: number; payment_method?: string }
  next_action?: { type: string; redirect_url: string }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Nexus-Key': CONTRACT_PUBLISHABLE_KEY,
    ...extra,
  }
}

async function post(base: string, path: string, body: unknown, extra?: Record<string, string>): Promise<Response> {
  return fetch(`${base}${path}`, { method: 'POST', headers: headers(extra), body: JSON.stringify(body) })
}

const futureCard = { exp_month: 12, exp_year: 2035, cvc: '123' }

async function tokenFor(base: string, number: string): Promise<string> {
  const response = await post(base, '/v1/tokens', { card: { number, ...futureCard } })
  expect(response.status).toBe(200)
  const body = await response.json() as { token: string }
  return body.token
}

async function intentFor(base: string, amount = 9900): Promise<IntentBody['payment_intent']> {
  const response = await post(base, '/v1/payment_intents', { amount, currency: 'cny' })
  expect(response.status).toBe(200)
  const body = await response.json() as IntentBody
  return body.payment_intent
}

/**
 * SDK-facing cases that both mock-api and apps/server must satisfy.
 * Assertions follow the running SDK and mock, not the places the written
 * contract document still disagrees with them.
 */
export function registerContractSuite(getBase: () => string): void {
  it('tokenizes a card without echoing the PAN', async () => {
    const base = getBase()
    const response = await post(base, '/v1/tokens', { card: { number: '4242424242424242', ...futureCard }, billing_details: { name: 'Ada' } })
    expect(response.status).toBe(200)
    const body = await response.json() as { token: string; payment_method_id: string; type: string; card: { brand: string; last4: string; funding: string } }
    expect(body.token).toMatch(/^tok_test_\d+$/)
    expect(body.payment_method_id).toMatch(/^pm_test_\d+$/)
    expect(body.type).toBe('card')
    expect(body.card).toMatchObject({ brand: 'visa', last4: '4242', funding: 'credit' })
    expect(JSON.stringify(body)).not.toContain('4242424242424242')
  })

  it('rejects empty, invalid, incomplete, and expired cards', async () => {
    const base = getBase()
    const empty = await post(base, '/v1/tokens', { card: { cvc: '123' } })
    expect((await empty.json() as ErrorBody).error.code).toBe('invalid_number')
    const luhn = await post(base, '/v1/tokens', { card: { number: '4242424242424243', ...futureCard } })
    expect(luhn.status).toBe(400)
    expect((await luhn.json() as ErrorBody).error.code).toBe('invalid_number')
    const incomplete = await post(base, '/v1/tokens', { card: { number: '4242424242424242', exp_month: 12 } })
    expect((await incomplete.json() as ErrorBody).error.code).toBe('incomplete_card')
    const expired = await post(base, '/v1/tokens', { card: { number: '4242424242424242', exp_month: 1, exp_year: 2020, cvc: '123' } })
    expect((await expired.json() as ErrorBody).error.code).toBe('invalid_expiry')
  })

  it('tokenizes a non-card payment method', async () => {
    const base = getBase()
    const response = await post(base, '/v1/tokens', { payment_method_type: 'ideal', ideal: { bank: 'ing' } })
    expect(response.status).toBe(200)
    const body = await response.json() as { type: string; ideal: { bank: string } }
    expect(body.type).toBe('ideal')
    expect(body.ideal.bank).toBe('ing')
  })

  it('creates a payment intent and confirms a successful card once', async () => {
    const base = getBase()
    const intent = await intentFor(base)
    expect(intent.id).toMatch(/^pi_test_\d+$/)
    expect(intent.status).toBe('requires_payment_method')
    expect(intent.currency).toBe('cny')
    expect(intent.client_secret.startsWith(`${intent.id}_secret_`)).toBe(true)
    const token = await tokenFor(base, '4242424242424242')
    const confirmed = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(confirmed.status).toBe(200)
    const body = await confirmed.json() as IntentBody
    expect(body.payment_intent.status).toBe('succeeded')
    expect(body.payment_intent.payment_method).toMatch(/^pm_test_/)
    const reused = await post(base, '/v1/payment_intents', { amount: 500, currency: 'usd' })
    const second = await reused.json() as IntentBody
    const again = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token }, { 'X-Nexus-Client-Secret': second.payment_intent.client_secret })
    expect(again.status).toBe(400)
    expect((await again.json() as ErrorBody).error.code).toBe('token_already_used')
  })

  it('rejects a missing or wrong client secret and a second confirm', async () => {
    const base = getBase()
    const missing = await post(base, '/v1/payment_intents/confirm', { payment_method_token: 'tok_test_missing' })
    expect(missing.status).toBe(404)
    expect((await missing.json() as ErrorBody).error.code).toBe('resource_missing')
    const intent = await intentFor(base, 100)
    const token = await tokenFor(base, '5555555555554444')
    const wrong = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token }, { 'X-Nexus-Client-Secret': 'pi_test_nope_secret_nope' })
    expect(wrong.status).toBe(404)
    const ok = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(ok.status).toBe(200)
    const duplicate = await post(base, '/v1/payment_intents/confirm', { payment_method_token: await tokenFor(base, '4242424242424242') }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json() as ErrorBody).error.code).toBe('payment_intent_already_confirmed')
  })

  it('declines test cards and challenges the 3DS card', async () => {
    const base = getBase()
    const cases = [
      ['4000000000000002', 'card_declined', 'generic_decline'],
      ['4000000000009995', 'card_declined', 'insufficient_funds'],
      ['4000000000000069', 'expired_card', 'expired_card'],
      ['4000000000000127', 'incorrect_cvc', 'incorrect_cvc'],
    ] as const
    for (const [pan, code, decline] of cases) {
      const intent = await intentFor(base, 200)
      const token = await tokenFor(base, pan)
      const response = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token }, { 'X-Nexus-Client-Secret': intent.client_secret })
      expect(response.status).toBe(402)
      const body = await response.json() as ErrorBody
      expect(body.error.code).toBe(code)
      expect(body.error.decline_code).toBe(decline)
      expect(body.error.payment_intent?.status).toBe('requires_payment_method')
    }
    const intent = await intentFor(base, 300)
    const token = await tokenFor(base, '4000000000003220')
    const challenge = await post(base, '/v1/payment_intents/confirm', { payment_method_token: token, return_url: 'https://merchant.test/back' }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(challenge.status).toBe(200)
    const challenged = await challenge.json() as IntentBody
    expect(challenged.payment_intent.status).toBe('requires_action')
    expect(challenged.next_action?.redirect_url).toContain('/3ds-mock')
    expect(challenged.next_action?.redirect_url).toContain(encodeURIComponent('https://merchant.test/back'))
    const done = await post(base, '/v1/3ds/complete', { intent: intent.id, status: 'approved' })
    expect(done.status).toBe(200)
    const after = await post(base, '/v1/payment_intents/confirm', { payment_method_token: await tokenFor(base, '4242424242424242') }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(after.status).toBe(409)
  })

  it('updates mutable fields, blocks amount changes after success, and cancels', async () => {
    const base = getBase()
    const open = await intentFor(base, 400)
    const updated = await post(base, `/v1/payment_intents/${open.id}`, { amount: 500, description: 'next', ignored_field: 'nope' })
    expect(updated.status).toBe(200)
    expect((await updated.json() as IntentBody).payment_intent.amount).toBe(500)
    const canceled = await post(base, `/v1/payment_intents/${open.id}/cancel`, {})
    expect((await canceled.json() as IntentBody).payment_intent.status).toBe('canceled')
    const paid = await intentFor(base, 600)
    await post(base, '/v1/payment_intents/confirm', { payment_method_token: await tokenFor(base, '4242424242424242') }, { 'X-Nexus-Client-Secret': paid.client_secret })
    const blocked = await post(base, `/v1/payment_intents/${paid.id}`, { amount: 700 })
    expect(blocked.status).toBe(409)
    const described = await post(base, `/v1/payment_intents/${paid.id}`, { description: 'still editable' })
    expect(described.status).toBe(200)
    const cannotCancel = await post(base, `/v1/payment_intents/${paid.id}/cancel`, {})
    expect(cannotCancel.status).toBe(409)
    expect((await post(base, '/v1/payment_intents', { amount: 0 })).status).toBe(400)
  })

  it('confirms a saved payment method and lists it', async () => {
    const base = getBase()
    const listed = await fetch(`${base}/v1/payment_methods`, { headers: headers() })
    const data = await listed.json() as { data: Array<{ id: string }> }
    expect(data.data.map((entry) => entry.id)).toEqual(expect.arrayContaining(['pm_saved_1', 'pm_saved_2']))
    const intent = await intentFor(base, 800)
    const confirmed = await post(base, '/v1/payment_intents/confirm', { payment_method_token: 'pm_saved_1' }, { 'X-Nexus-Client-Secret': intent.client_secret })
    expect(confirmed.status).toBe(200)
    expect((await confirmed.json() as IntentBody).payment_intent.payment_method).toBe('pm_saved_1')
  })

  it('saves a card with a setup intent and declines a bad one', async () => {
    const base = getBase()
    const created = await post(base, '/v1/setup_intents', { usage: 'off_session', customer_email: 'a@example.com' })
    const setup = await created.json() as { setup_intent: { id: string; client_secret: string; status: string } }
    expect(setup.setup_intent.id).toMatch(/^seti_test_/)
    expect(setup.setup_intent.status).toBe('requires_payment_method')
    const confirmed = await post(base, '/v1/setup_intents/confirm', { payment_method_token: await tokenFor(base, '378282246310005') }, { 'X-Nexus-Client-Secret': setup.setup_intent.client_secret })
    expect(confirmed.status).toBe(200)
    expect((await confirmed.json() as { setup_intent: { status: string; payment_method: string } }).setup_intent.status).toBe('succeeded')
    const bad = await post(base, '/v1/setup_intents', {})
    const badSetup = await bad.json() as { setup_intent: { client_secret: string } }
    const declined = await post(base, '/v1/setup_intents/confirm', { payment_method_token: await tokenFor(base, '4000000000000002') }, { 'X-Nexus-Client-Secret': badSetup.setup_intent.client_secret })
    expect(declined.status).toBe(402)
  })

  it('opens, reads, declines, and completes a checkout session', async () => {
    const base = getBase()
    const created = await post(base, '/v1/checkout/sessions', {
      mode: 'payment',
      ui_mode: 'embedded',
      amount: 12900,
      currency: 'cny',
      line_items: [{ name: 'Nexus Pro', amount: 12900, quantity: 1 }],
      success_url: 'https://merchant.test/ok?session_id={SESSION_ID}',
    })
    const session = await created.json() as { checkout_session: { id: string; client_secret: string; status: string; url: string } }
    expect(session.checkout_session.id).toMatch(/^cs_test_/)
    expect(session.checkout_session.status).toBe('open')
    expect(session.checkout_session.url).toContain(session.checkout_session.id)
    const secret = { 'X-Nexus-Client-Secret': session.checkout_session.client_secret }
    const fetched = await fetch(`${base}/v1/checkout/sessions/${session.checkout_session.id}`, { headers: headers(secret) })
    expect(fetched.status).toBe(200)
    const denied = await fetch(`${base}/v1/checkout/sessions/${session.checkout_session.id}`, { headers: headers({ 'X-Nexus-Client-Secret': 'nope' }) })
    expect(denied.status).toBe(401)
    const challenge = await post(base, `/v1/checkout/sessions/${session.checkout_session.id}/confirm`, { payment_method_token: await tokenFor(base, '4000000000003220') }, secret)
    expect(challenge.status).toBe(200)
    const declined = await post(base, '/v1/checkout/sessions', { amount: 100, currency: 'usd' })
    const other = await declined.json() as { checkout_session: { id: string; client_secret: string } }
    const decline = await post(base, `/v1/checkout/sessions/${other.checkout_session.id}/confirm`, { payment_method_token: await tokenFor(base, '4000000000000002') }, { 'X-Nexus-Client-Secret': other.checkout_session.client_secret })
    expect(decline.status).toBe(402)
    expect((await decline.json() as ErrorBody).error.message).toContain('拒绝')
  })

  it('publishes an RSA-OAEP JWK and accepts an encrypted card', async () => {
    const base = getBase()
    const keyRes = await fetch(`${base}/v1/encryption_key`, { headers: headers() })
    expect(keyRes.status).toBe(200)
    const key = await keyRes.json() as { key_id: string; algorithm: string; public_key_jwk: JsonWebKey }
    expect(key.algorithm).toBe('RSA-OAEP')
    expect(key.public_key_jwk.kty).toBe('RSA')
    const card = { number: '4242424242424242', ...futureCard }
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(card))))
    const pub = await crypto.subtle.importKey('jwk', key.public_key_jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new Uint8Array(await crypto.subtle.exportKey('raw', aes))))
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
    const encrypted = await post(base, '/v1/tokens', {
      encrypted_card: { key_id: key.key_id, alg: 'RSA-OAEP-256+A256GCM', ek: b64(ek), iv: b64(iv), ciphertext: b64(cipher) },
    })
    expect(encrypted.status).toBe(200)
    const body = await encrypted.json() as { token: string }
    expect(body.token).toMatch(/^tok_test_/)
    expect(JSON.stringify(body)).not.toContain('4242424242424242')
  })

  it('stores orders and reports apple pay as unavailable', async () => {
    const base = getBase()
    const saved = await post(base, '/v1/orders/ord_1', { status: 'processing', items: [{ name: 'A' }] })
    expect(saved.status).toBe(200)
    const loaded = await fetch(`${base}/v1/orders/ord_1`, { headers: headers() })
    expect((await loaded.json() as { order: { status: string } }).order.status).toBe('processing')
    const missing = await fetch(`${base}/v1/orders/missing`, { headers: headers() })
    expect(missing.status).toBe(404)
    const apple = await post(base, '/v1/apple_pay/sessions', { validation_url: 'https://apple.test' })
    expect(apple.status).toBe(501)
    expect((await apple.json() as ErrorBody).error.code).toBe('apple_pay_unavailable')
    const unknown = await fetch(`${base}/v1/not-an-endpoint`, { headers: headers() })
    expect(unknown.status).toBe(404)
    expect((await unknown.json() as ErrorBody).error.code).toBe('unknown_endpoint')
  })
}
