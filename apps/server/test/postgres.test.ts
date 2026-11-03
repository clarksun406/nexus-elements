import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { applyMigration } from '../src/db/migrate.js'
import { seedSavedMethods } from '../src/services/deps.js'
import { ManualClock, PUBLISHABLE_KEY, testConfig } from './helpers.js'
import type { FastifyInstance } from 'fastify'

const databaseUrl = process.env.DATABASE_URL
if (process.env.COVERAGE === '1' && !databaseUrl) {
  throw new Error('DATABASE_URL is required when running server coverage so the Postgres repository is measured')
}

describe.skipIf(!databaseUrl)('postgres integration', () => {
  let app: FastifyInstance
  const clock = new ManualClock()

  beforeAll(async () => {
    app = await buildApp(testConfig({ store: 'postgres', databaseUrl, webhookUrl: undefined }), { clock })
    await app.deps.repo.resetBusinessData()
    await seedSavedMethods(app.deps)
  })

  afterAll(async () => {
    await app.close()
  })

  it('persists a confirmed payment, hides the PAN, and reloads the encryption key', async () => {
    const created = await call('/v1/payment_intents', { amount: 9900, currency: 'cny', description: 'db' })
    expect(created.statusCode).toBe(200)
    const secret = created.json().payment_intent.client_secret as string
    const intentId = created.json().payment_intent.id as string
    const token = await call('/v1/tokens', { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' } })
    expect(await app.deps.repo.containsRawValue('4242424242424242')).toBe(false)
    const confirmed = await call('/v1/payment_intents/confirm', { payment_method_token: token.json().token }, { 'idempotency-key': 'pg-confirm', 'x-nexus-client-secret': secret })
    expect(confirmed.statusCode).toBe(200)
    const replay = await call('/v1/payment_intents/confirm', { payment_method_token: token.json().token }, { 'idempotency-key': 'pg-confirm', 'x-nexus-client-secret': secret })
    expect(replay.statusCode).toBe(200)
    const key = (await callGet('/v1/encryption_key')).json() as { public_key_jwk: { n?: string } }
    const restarted = await buildApp(testConfig({ store: 'postgres', databaseUrl }))
    try {
      const again = await restarted.inject({
        method: 'POST',
        url: '/v1/payment_intents/confirm',
        payload: { payment_method_token: 'tok_test_missing' },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': secret },
      })
      expect(again.statusCode).toBe(409)
      const loaded = (await restarted.inject({ method: 'GET', url: '/v1/encryption_key', headers: { 'x-nexus-key': PUBLISHABLE_KEY } })).json() as { public_key_jwk: { n?: string } }
      expect(loaded.public_key_jwk.n).toBe(key.public_key_jwk.n)
      const missing = await restarted.inject({
        method: 'POST',
        url: `/v1/payment_intents/${intentId}`,
        payload: { description: 'kept' },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      expect(missing.statusCode).toBe(200)
      expect(await restarted.deps.repo.findPaymentIntentById('pi_test_missing')).toBeNull()
      expect(await restarted.deps.repo.findPaymentIntentBySecret('missing')).toBeNull()
      expect((await restarted.deps.repo.listWebhookEvents(restarted.deps.config.accountId)).length).toBeGreaterThan(0)
      await restarted.deps.repo.abortIdempotency(restarted.deps.config.accountId, 'does-not-exist')
      const order = await restarted.inject({
        method: 'POST',
        url: '/v1/orders/ord_pg',
        payload: { status: 'paid' },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      expect(order.statusCode).toBe(200)
      expect(await restarted.deps.repo.containsRawValue('4242424242424242')).toBe(false)
      expect(await restarted.deps.repo.containsRawValue('db')).toBe(true)
      const setup = await restarted.inject({
        method: 'POST',
        url: '/v1/setup_intents',
        payload: { usage: 'off_session', customer_email: 'db@example.com' },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const setupToken = await restarted.inject({
        method: 'POST',
        url: '/v1/tokens',
        payload: { card: { number: '5555555555554444', exp_month: 12, exp_year: 2035, cvc: '123' } },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const setupPaid = await restarted.inject({
        method: 'POST',
        url: '/v1/setup_intents/confirm',
        payload: { payment_method_token: setupToken.json().token },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': setup.json().setup_intent.client_secret },
      })
      expect(setupPaid.statusCode).toBe(200)
      const session = await restarted.inject({
        method: 'POST',
        url: '/v1/checkout/sessions',
        payload: { amount: 700, currency: 'usd', success_url: 'https://merchant.test/ok', line_items: [{ name: 'Row', amount: 700, quantity: 1 }] },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const sessionToken = await restarted.inject({
        method: 'POST',
        url: '/v1/tokens',
        payload: { payment_method_type: 'ideal', ideal: { bank: 'ing' } },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const sessionPaid = await restarted.inject({
        method: 'POST',
        url: `/v1/checkout/sessions/${session.json().checkout_session.id}/confirm`,
        payload: { payment_method_token: sessionToken.json().token },
        headers: {
          'content-type': 'application/json',
          'x-nexus-key': PUBLISHABLE_KEY,
          'x-nexus-client-secret': session.json().checkout_session.client_secret,
        },
      })
      expect(sessionPaid.statusCode).toBe(200)
      const sessionView = await restarted.inject({
        method: 'GET',
        url: `/v1/checkout/sessions/${session.json().checkout_session.id}`,
        headers: { 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': session.json().checkout_session.client_secret },
      })
      expect(sessionView.json().checkout_session.status).toBe('complete')
    } finally {
      await restarted.close()
    }
  })

  it('enforces token expiry against the injected clock', async () => {
    const local = new ManualClock()
    const timed = await buildApp(testConfig({ store: 'postgres', databaseUrl }), { clock: local })
    try {
      const intent = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents',
        payload: { amount: 100 },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      const token = await timed.inject({
        method: 'POST',
        url: '/v1/tokens',
        payload: { card: { number: '4242424242424242', exp_month: 12, exp_year: 2035, cvc: '123' } },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      local.advance(6 * 60 * 1000)
      const expired = await timed.inject({
        method: 'POST',
        url: '/v1/payment_intents/confirm',
        payload: { payment_method_token: token.json().token },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': intent.json().payment_intent.client_secret },
      })
      expect(expired.json().error.code).toBe('token_expired')
      const setup = await timed.inject({
        method: 'POST',
        url: '/v1/setup_intents',
        payload: { usage: 'on_session' },
        headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY },
      })
      expect(setup.statusCode).toBe(200)
      expect(await timed.deps.repo.findSetupIntentBySecret('missing')).toBeNull()
      expect(await timed.deps.repo.findCheckoutSessionById('missing')).toBeNull()
      expect(await timed.deps.repo.findOrder(timed.deps.config.accountId, 'missing')).toBeNull()
      const pool = new pg.Pool({ connectionString: databaseUrl })
      const client = await pool.connect()
      try {
        await expect(applyMigration(client, 'THIS IS NOT SQL')).rejects.toThrow()
        await pool.query("DELETE FROM schema_migrations WHERE id = '001_init.sql'")
      } finally {
        client.release()
        await pool.end()
      }
      const reapplied = await buildApp(testConfig({ store: 'postgres', databaseUrl }))
      expect((await reapplied.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
      await reapplied.close()
    } finally {
      await timed.close()
    }
  })

  function call(url: string, payload: unknown, headers: Record<string, string> = {}) {
    return app.inject({
      method: 'POST',
      url,
      payload,
      headers: { 'content-type': 'application/json', 'x-nexus-key': PUBLISHABLE_KEY, ...headers },
    })
  }

  function callGet(url: string) {
    return app.inject({ method: 'GET', url, headers: { 'x-nexus-key': PUBLISHABLE_KEY } })
  }
})
