import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { canCancel, canConfirm, canTransition, assertTransition } from '../src/services/state-machine.js'
import { SandboxChannel } from '../src/gateway/sandbox.js'
import { redact } from '../src/crypto/redact.js'
import { signWebhook, verifyWebhook } from '../src/crypto/webhook.js'
import { EncryptionKeys } from '../src/crypto/keys.js'
import { panFingerprint } from '../src/crypto/fingerprint.js'
import { authenticateHeaders } from '../src/auth/keys.js'
import { loadConfig } from '../src/config.js'
import { MemoryRepository } from '../src/db/memory.js'
import { runIdempotent } from '../src/services/idempotency.js'
import { ok } from '../src/services/result.js'
import { buildApp } from '../src/app.js'
import { ManualClock, PUBLISHABLE_KEY, SECRET_KEY, testConfig } from './helpers.js'
import type { FastifyInstance } from 'fastify'

const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function boot(overrides: Parameters<typeof testConfig>[0] = {}, clock?: ManualClock): Promise<FastifyInstance> {
  const app = await buildApp(testConfig(overrides), clock ? { clock } : {})
  apps.push(app)
  return app
}

function call(app: FastifyInstance, method: 'GET' | 'POST', url: string, payload?: unknown, headers?: Record<string, string>) {
  return app.inject({
    method,
    url,
    payload,
    headers: {
      'content-type': 'application/json',
      'x-nexus-key': PUBLISHABLE_KEY,
      ...headers,
    },
  })
}

describe('state machine', () => {
  it('allows the synchronous confirm transitions the SDK observes', () => {
    expect(canConfirm('requires_payment_method')).toBe(true)
    expect(canConfirm('requires_action')).toBe(true)
    expect(canConfirm('succeeded')).toBe(false)
    expect(canConfirm('canceled')).toBe(false)
    expect(canConfirm('processing')).toBe(false)
    expect(canCancel('canceled')).toBe(true)
    expect(canCancel('succeeded')).toBe(false)
    expect(canTransition('requires_payment_method', 'succeeded')).toBe(true)
    expect(canTransition('requires_action', 'requires_payment_method')).toBe(true)
    expect(canTransition('processing', 'canceled')).toBe(true)
    expect(canTransition('succeeded', 'canceled')).toBe(false)
    expect(() => assertTransition('succeeded', 'canceled')).toThrow(/Illegal/)
    expect(() => assertTransition('requires_payment_method', 'succeeded')).not.toThrow()
  })
})

describe('sandbox gateway', () => {
  const gateway = new SandboxChannel()
  const base = { amount: 100, currency: 'cny', paymentMethodType: 'card', merchantId: 'acct', intentId: 'pi_test_1', returnUrl: '/back' }

  it('maps classified outcomes without seeing a PAN', async () => {
    expect((await gateway.authorize({ ...base, outcome: { kind: 'success' } })).status).toBe('succeeded')
    const declined = await gateway.authorize({ ...base, outcome: { kind: 'decline', code: 'card_declined', decline_code: 'generic_decline', message: 'no' } })
    expect(declined.decline?.decline_code).toBe('generic_decline')
    const action = await gateway.authorize({ ...base, outcome: { kind: 'requires_action' } })
    expect(action.redirectUrl).toContain('/3ds-mock?intent=pi_test_1')
    expect(action.redirectUrl).toContain(encodeURIComponent('/back'))
    const fallback = await gateway.authorize({ ...base, returnUrl: undefined, outcome: { kind: 'requires_action' } })
    expect(fallback.redirectUrl).toContain(encodeURIComponent('/'))
  })
})

describe('crypto', () => {
  it('redacts PAN, CVC, and wrapped keys', () => {
    const cleaned = redact({
      card: { number: '4242424242424242', cvc: '123', exp_month: 12 },
      encrypted_card: { ek: 'secret', iv: 'iv' },
      nested: [{ pan: '4111', ok: true }],
      note: 'safe',
    }) as { card: { number: string; exp_month: number }; encrypted_card: string; nested: Array<{ pan: string; ok: boolean }>; note: string }
    expect(cleaned.card.number).toBe('[redacted]')
    expect(cleaned.card.exp_month).toBe(12)
    expect(cleaned.encrypted_card).toBe('[redacted]')
    expect(cleaned.nested[0]?.pan).toBe('[redacted]')
    expect(cleaned.note).toBe('safe')
    expect(redact('plain')).toBe('plain')
    expect(redact(null)).toBe(null)
  })

  it('signs and verifies webhook payloads inside the tolerance window', () => {
    const payload = '{"id":"evt_test_1"}'
    const header = signWebhook('whsec', payload, 1_000)
    expect(verifyWebhook('whsec', header, payload, 1_100)).toBe(true)
    expect(verifyWebhook('whsec', header, payload, 2_000)).toBe(false)
    expect(verifyWebhook('whsec', header, '{"id":"other"}', 1_000)).toBe(false)
    expect(verifyWebhook('whsec', 'nope', payload, 1_000)).toBe(false)
    expect(verifyWebhook('whsec', 't=1000,v1=abcd', payload, 1_000)).toBe(false)
  })

  it('decrypts an SDK hybrid payload and rejects a mismatched key id', async () => {
    const keys = new EncryptionKeys('ek_test')
    const described = keys.describe(10)
    expect(described.public_key_pem).toContain('BEGIN PUBLIC KEY')
    const card = { number: '4242424242424242', cvc: '123' }
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(card))))
    const pub = await crypto.subtle.importKey('jwk', described.public_key_jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new Uint8Array(await crypto.subtle.exportKey('raw', aes))))
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
    const payload = { key_id: 'ek_test', ek: b64(ek), iv: b64(iv), ciphertext: b64(cipher) }
    expect(keys.decryptCard(payload)).toMatchObject(card)
    expect(keys.decryptCard({ ...payload, key_id: 'ek_other' })).toBeNull()
    expect(keys.decryptCard({ key_id: 'ek_test' })).toBeNull()
    expect(keys.decryptCard({ ...payload, ciphertext: b64(new Uint8Array(8)) })).toBeNull()
    const restored = new EncryptionKeys('ek_test', keys.exportPrivatePem())
    expect(restored.decryptCard(payload)).toMatchObject(card)
    expect(panFingerprint('secret', '4242424242424242')).toBe(createHmac('sha256', 'secret').update('4242424242424242').digest('hex'))
    expect(redact({ private_key_pem: keys.exportPrivatePem() })).toMatchObject({ private_key_pem: '[redacted]' })
  })
})

describe('auth and config', () => {
  const config = testConfig()

  it('accepts the publishable key and the secret key, and rejects mismatches', () => {
    expect(authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY }, config).ok).toBe(true)
    const secret = authenticateHeaders({ authorization: `Bearer ${SECRET_KEY}` }, config)
    expect(secret.ok && secret.merchant.auth).toBe('secret')
    expect(authenticateHeaders({}, config)).toMatchObject({ ok: false, status: 401 })
    expect(authenticateHeaders({ 'x-nexus-key': 'pk_test_other' }, config)).toMatchObject({ status: 401 })
    expect(authenticateHeaders({ authorization: 'Bearer sk_test_other' }, config)).toMatchObject({ status: 401 })
    expect(authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-account': 'acct_other' }, config)).toMatchObject({ status: 403, code: 'account_invalid' })
    expect(authenticateHeaders({ 'x-nexus-key': [PUBLISHABLE_KEY] }, config).ok).toBe(true)
  })

  it('refuses sample secrets in production and inconsistent key modes', () => {
    expect(() => loadConfig({ env: { NODE_ENV: 'production' }, enforceProduction: true })).toThrow(/required/)
    expect(() => loadConfig({
      env: {
        NODE_ENV: 'production',
        NEXUS_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
        NEXUS_SECRET_KEY: SECRET_KEY,
        NEXUS_WEBHOOK_SECRET: 'whsec_real',
      },
    })).toThrow(/sample secret/)
    expect(() => loadConfig({
      env: { NEXUS_PUBLISHABLE_KEY: 'pk_live_merchant', NEXUS_SECRET_KEY: 'sk_test_merchant', NEXUS_WEBHOOK_SECRET: 'whsec' },
      enforceProduction: false,
    })).toThrow(/same mode/)
    expect(() => loadConfig({ env: { STORE: 'postgres' }, enforceProduction: false })).toThrow(/DATABASE_URL/)
    expect(() => loadConfig({ env: { PORT: 'nope' }, enforceProduction: false })).toThrow(/PORT/)
    expect(() => loadConfig({ env: { NEXUS_PUBLISHABLE_KEY: 'not-a-key', NEXUS_SECRET_KEY: 'sk_test_x' }, enforceProduction: false })).toThrow(/pk_test_/)
    const live = loadConfig({
      env: { NEXUS_PUBLISHABLE_KEY: 'pk_live_merchant', NEXUS_SECRET_KEY: 'sk_live_merchant', STORE: 'memory' },
      enforceProduction: false,
    })
    expect(live.mode).toBe('live')
  })
})

describe('http behavior beyond the shared contract', () => {
  it('requires a key, scopes the account header, and lets a secret key create intents', async () => {
    const app = await boot()
    const missing = await app.inject({ method: 'POST', url: '/v1/payment_intents', payload: { amount: 100 }, headers: { 'content-type': 'application/json' } })
    expect(missing.statusCode).toBe(401)
    const account = await call(app, 'POST', '/v1/payment_intents', { amount: 100 }, { 'x-nexus-account': 'acct_other' })
    expect(account.statusCode).toBe(403)
    const created = await call(app, 'POST', '/v1/payment_intents', { amount: 100, currency: 'USD', capture_method: 'manual' }, { 'x-nexus-key': '', authorization: `Bearer ${SECRET_KEY}` })
    expect(created.statusCode).toBe(200)
    expect(created.json().payment_intent.currency).toBe('usd')
    expect(created.json().payment_intent.capture_method).toBe('manual')
    const health = await app.inject({ method: 'GET', url: '/health' })
    expect(health.json()).toMatchObject({ status: 'ok', store: 'memory' })
    const page = await app.inject({ method: 'GET', url: '/3ds-mock?intent=pi_test_1&return_url=/' })
    expect(page.body).toContain('button class="approve"')
    expect(page.headers['x-frame-options']).toBeUndefined()
    const checkout = await app.inject({ method: 'GET', url: '/__nexus-checkout/index.html' })
    expect(checkout.body).toContain('id="cs-total"')
    const api = await call(app, 'GET', '/v1/payment_methods')
    expect(api.headers['x-frame-options']).toBe('DENY')
  })

  it('rejects publishable creates when disabled and still confirms with pk_', async () => {
    const app = await boot({ allowPublishableCreates: false })
    const denied = await call(app, 'POST', '/v1/payment_intents', { amount: 100 })
    expect(denied.statusCode).toBe(401)
    expect(denied.json().error.code).toBe('publishable_key_not_allowed')
    const created = await call(app, 'POST', '/v1/payment_intents', { amount: 250 }, { authorization: `Bearer ${SECRET_KEY}`, 'x-nexus-key': '' })
    expect(created.statusCode).toBe(200)
    const token = await call(app, 'POST', '/v1/tokens', { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' } })
    const confirmed = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: token.json().token }, { 'x-nexus-client-secret': created.json().payment_intent.client_secret })
    expect(confirmed.statusCode).toBe(200)
  })

  it('expires a token, replays an idempotency key, and keeps the PAN out of the store', async () => {
    const clock = new ManualClock()
    const app = await boot({ webhookUrl: 'http://127.0.0.1:9' }, clock)
    const intent = await call(app, 'POST', '/v1/payment_intents', { amount: 100, metadata: { order_id: '1' } })
    const secret = intent.json().payment_intent.client_secret as string
    const token = await call(app, 'POST', '/v1/tokens', { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '999' } })
    expect(await app.deps.repo.containsRawValue('4242424242424242')).toBe(false)
    clock.advance(6 * 60 * 1000)
    const expired = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: token.json().token }, { 'x-nexus-client-secret': secret })
    expect(expired.json().error.code).toBe('token_expired')
    clock.advance(-6 * 60 * 1000)
    const fresh = await call(app, 'POST', '/v1/tokens', { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' } })
    const confirmHeaders = { 'x-nexus-client-secret': secret, 'idempotency-key': 'idem_1' }
    const first = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: fresh.json().token }, confirmHeaders)
    expect(first.statusCode).toBe(200)
    const replay = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: fresh.json().token }, confirmHeaders)
    expect(replay.statusCode).toBe(200)
    expect(replay.json().payment_intent.status).toBe('succeeded')
    const conflict = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: 'other' }, confirmHeaders)
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('idempotency_key_in_use')
    const events = await app.deps.repo.listWebhookEvents(app.deps.config.accountId)
    const succeeded = events.find((event) => event.type === 'payment_intent.succeeded')
    expect(succeeded).toBeTruthy()
    const signature = String((succeeded?.payload as { signature?: string }).signature)
    expect(verifyWebhook(
      app.deps.config.webhookSecret,
      signature,
      JSON.stringify(stripSignature(succeeded?.payload)),
      succeeded?.created ?? 0,
    )).toBe(true)
  })

  it('fails 3DS, updates currency, and reports invalid JSON', async () => {
    const app = await boot()
    const intent = (await call(app, 'POST', '/v1/payment_intents', { amount: 100 })).json().payment_intent
    const token = (await call(app, 'POST', '/v1/tokens', { card: { number: '4000000000003220', exp_month: 12, exp_year: 2035, cvc: '123' } })).json().token
    const challenged = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(challenged.json().payment_intent.status).toBe('requires_action')
    await call(app, 'POST', '/v1/3ds/complete', { intent: intent.id, status: 'failed' })
    const events = await app.deps.repo.listWebhookEvents(app.deps.config.accountId)
    expect(events.some((event) => event.type === 'payment_intent.payment_failed')).toBe(true)
    const retry = await call(app, 'POST', '/v1/tokens', { card: { number: '6200000000000005', exp_month: 12, exp_year: 2035, cvc: '123' } })
    const paid = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: retry.json().token }, { 'x-nexus-client-secret': intent.client_secret })
    expect(paid.statusCode).toBe(200)
    const editable = (await call(app, 'POST', '/v1/payment_intents', { amount: 80, currency: 'cny' })).json().payment_intent
    const renamed = await call(app, 'POST', `/v1/payment_intents/${editable.id}`, { currency: 'EUR', receipt_email: 'a@b.c' })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json().payment_intent.currency).toBe('eur')
    expect(renamed.json().payment_intent.receipt_email).toBe('a@b.c')
    const badAmount = await call(app, 'POST', '/v1/payment_intents', { amount: 1.5 })
    expect(badAmount.statusCode).toBe(400)
    const invalid = await app.inject({ method: 'POST', url: '/v1/tokens', headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY }, payload: '{not-json' })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().error.code).toBe('invalid_json')
    const missingIntent = await call(app, 'POST', '/v1/payment_intents/pi_test_999/cancel', {})
    expect(missingIntent.statusCode).toBe(404)
    const unknownSaved = await call(app, 'POST', '/v1/payment_intents', { amount: 50 })
    const unknown = await call(app, 'POST', '/v1/payment_intents/confirm', { payment_method_token: 'pm_saved_missing' }, { 'x-nexus-client-secret': unknownSaved.json().payment_intent.client_secret })
    expect(unknown.json().error.code).toBe('invalid_token')
    const arrayBody = await app.inject({ method: 'POST', url: '/v1/tokens', headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY }, payload: '[1]' })
    expect(arrayBody.statusCode).toBe(400)
    app.deps.repo.insertPaymentIntent = async () => { throw new Error('db down') }
    const broken = await call(app, 'POST', '/v1/payment_intents', { amount: 100 })
    expect(broken.statusCode).toBe(500)
    expect(broken.json().error.code).toBe('internal_error')
  })

  it('covers setup, checkout, and update edges', async () => {
    const app = await boot()
    const setup = (await call(app, 'POST', '/v1/setup_intents', { usage: 'on_session', customer_email: 'a@example.com' })).json().setup_intent
    const missing = await call(app, 'POST', '/v1/setup_intents/confirm', { payment_method_token: 'tok_missing' })
    expect(missing.statusCode).toBe(404)
    const ideal = (await call(app, 'POST', '/v1/tokens', { payment_method_type: 'ideal', ideal: { bank: 'ing' }, billing_details: { name: 'Ada' } })).json()
    const saved = await call(app, 'POST', '/v1/setup_intents/confirm', { payment_method_token: ideal.token }, { 'x-nexus-client-secret': setup.client_secret })
    expect(saved.statusCode).toBe(200)
    expect(saved.json().payment_method).toBeUndefined()
    const again = await call(app, 'POST', '/v1/setup_intents/confirm', { payment_method_token: ideal.payment_method_id }, { 'x-nexus-client-secret': setup.client_secret })
    expect(again.statusCode).toBe(409)
    const session = (await call(app, 'POST', '/v1/checkout/sessions', { amount: 500, success_url: 'https://ok', line_items: [{ name: 'A', quantity: 1, amount: 500 }, 'nope'] })).json().checkout_session
    const absent = await call(app, 'GET', '/v1/checkout/sessions/cs_test_missing')
    expect(absent.statusCode).toBe(404)
    const token = (await call(app, 'POST', '/v1/tokens', { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' }, billing_details: { name: 'Ada' } })).json()
    const paid = await call(app, 'POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: token.payment_method_id }, { 'x-nexus-client-secret': session.client_secret })
    expect(paid.statusCode).toBe(200)
    const closed = await call(app, 'POST', `/v1/checkout/sessions/${session.id}/confirm`, { payment_method_token: token.token }, { 'x-nexus-client-secret': session.client_secret })
    expect(closed.statusCode).toBe(409)
    const open = (await call(app, 'POST', '/v1/payment_intents', { amount: 100 })).json().payment_intent
    const updated = await call(app, 'POST', `/v1/payment_intents/${open.id}`, { amount: 250, description: 'd', metadata: { k: 'v' }, payment_method_types: ['card', 'ideal'], receipt_email: 'a@b.c' })
    expect(updated.json().payment_intent.amount).toBe(250)
    expect(updated.json().payment_intent.payment_method_types).toEqual(['card', 'ideal'])
    const bad = await call(app, 'POST', `/v1/payment_intents/${open.id}`, { amount: -1 })
    expect(bad.statusCode).toBe(400)
    const garbled = await call(app, 'POST', '/v1/tokens', { encrypted_card: 'nope' })
    expect(garbled.json().error.code).toBe('decryption_failed')
  })

  it('rate limits tokenization and reflects only allowlisted origins', async () => {
    const app = await boot({ rateLimitMax: 20, tokenRateLimitMax: 2 })
    const first = await call(app, 'POST', '/v1/tokens', { payment_method_type: 'ideal' })
    const second = await call(app, 'POST', '/v1/tokens', { payment_method_type: 'ideal' })
    const third = await call(app, 'POST', '/v1/tokens', { payment_method_type: 'ideal' })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(third.statusCode).toBe(429)
    expect(third.json().error.code).toBe('rate_limited')
    const allowed = await call(app, 'GET', '/health')
    expect(allowed.statusCode).toBe(200)
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/payment_methods',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    })
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    const blocked = await app.inject({
      method: 'GET',
      url: '/v1/payment_methods',
      headers: { origin: 'https://evil.example', 'x-nexus-key': PUBLISHABLE_KEY },
    })
    expect(blocked.statusCode).toBe(200)
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('aborts an in-flight idempotency key when the handler throws or returns 500', async () => {
    const repo = new MemoryRepository()
    const deps = { repo } as unknown as Parameters<typeof runIdempotent>[0]
    await expect(runIdempotent(deps, 'acct', 'k1', 'POST', '/v1/tokens', '{}', async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    const retried = await runIdempotent(deps, 'acct', 'k1', 'POST', '/v1/tokens', '{}', async () => ok({ ok: true }))
    expect(retried.status).toBe(200)
    await runIdempotent(deps, 'acct', 'k2', 'POST', '/v1/tokens', '{}', async () => ({ status: 500, body: { error: { type: 'api_error' } } }))
    const after = await runIdempotent(deps, 'acct', 'k2', 'POST', '/v1/tokens', '{}', async () => ok({ retried: true }))
    expect(after.body).toMatchObject({ retried: true })
    const busy = await repo.beginIdempotency({ merchantId: 'acct', key: 'k3', method: 'POST', path: '/v1/x', requestHash: 'hash' })
    expect(busy.state).toBe('started')
    const conflict = await repo.beginIdempotency({ merchantId: 'acct', key: 'k3', method: 'POST', path: '/v1/x', requestHash: 'hash' })
    expect(conflict).toMatchObject({ state: 'conflict', code: 'idempotency_key_in_progress' })
    await repo.abortIdempotency('acct', 'k3')
    await repo.saveEncryptionPrivateKey('ek', 'pem')
    expect(await repo.getEncryptionPrivateKey('ek')).toBe('pem')
    expect(await repo.getEncryptionPrivateKey('missing')).toBeNull()
    await repo.resetBusinessData()
    expect(await repo.listWebhookEvents('acct')).toEqual([])
    await repo.close()
  })
})

function stripSignature(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload) return {}
  const clone = { ...payload }
  delete clone.signature
  return clone
}
