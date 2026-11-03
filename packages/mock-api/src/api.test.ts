import type { ServerResponse } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMockServer } from './server.js'
import { MockStore } from './store.js'
import { validateAndConsumeToken } from './handlers/payment-intents.js'
import type { MockToken } from './types.js'

function responseStub() {
  const headers = new Map<string, string>()
  let body = ''
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers.set(name, value) },
    end(payload?: string) { body = payload ?? '' },
  }
  return { res: res as unknown as ServerResponse, read: () => JSON.parse(body) as { error?: { code?: string } } }
}

describe('token lifetime', () => {
  it('rejects an expired token and a second use of the same token', () => {
    const store = new MockStore()
    const expired: MockToken = {
      token: 'tok_old',
      payment_method_id: 'pm_old',
      type: 'card',
      used: false,
      expires_at: Date.now() - 1000,
    }
    store.tokens.set(expired.token, expired)
    const first = responseStub()
    expect(validateAndConsumeToken(store, 'tok_old', first.res)).toBeNull()
    expect(first.read().error?.code).toBe('token_expired')

    const fresh: MockToken = { ...expired, token: 'tok_new', expires_at: Date.now() + 60_000 }
    store.tokens.set(fresh.token, fresh)
    const ok = responseStub()
    expect(validateAndConsumeToken(store, 'tok_new', ok.res)?.token).toBe('tok_new')
    const again = responseStub()
    expect(validateAndConsumeToken(store, 'tok_new', again.res)).toBeNull()
    expect(again.read().error?.code).toBe('token_already_used')
  })
})

describe('mock server', () => {
  let base = ''
  let close: () => Promise<void> = async () => {}

  beforeAll(async () => {
    const server = await createMockServer({ port: 0 })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    base = `http://127.0.0.1:${address.port}`
    close = () => new Promise((resolve) => server.close(() => resolve()))
  })

  afterAll(async () => {
    await close()
  })

  it('serves checkout on both routes and denies framing the API', async () => {
    const checkout = await fetch(`${base}/__nexus-checkout/index.html`)
    expect(checkout.status).toBe(200)
    expect(await checkout.text()).toContain('id="cs-total"')
    expect(checkout.headers.get('content-security-policy')).toContain('frame-ancestors')
    const api = await fetch(`${base}/v1/payment_methods`)
    expect(api.headers.get('x-frame-options')).toBe('DENY')
  })

  it('issues a single-use card token and decrypts an application-layer payload', async () => {
    const plain = await fetch(`${base}/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' } }),
    })
    const created = await plain.json() as { token: string }
    const intent = await fetch(`${base}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, currency: 'usd' }),
    })
    const { payment_intent: paymentIntent } = await intent.json() as { payment_intent: { client_secret: string } }
    const confirm = async () => fetch(`${base}/v1/payment_intents/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Client-Secret': paymentIntent.client_secret },
      body: JSON.stringify({ payment_method_token: created.token }),
    })
    expect((await confirm()).status).toBe(200)
    const secondIntent = await fetch(`${base}/v1/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, currency: 'usd' }),
    })
    const second = await secondIntent.json() as { payment_intent: { client_secret: string } }
    const reused = await fetch(`${base}/v1/payment_intents/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Client-Secret': second.payment_intent.client_secret },
      body: JSON.stringify({ payment_method_token: created.token }),
    })
    expect(reused.status).toBe(400)
    expect((await reused.json() as { error: { code: string } }).error.code).toBe('token_already_used')

    const keyRes = await fetch(`${base}/v1/encryption_key`)
    const key = await keyRes.json() as { key_id: string; public_key_jwk: JsonWebKey }
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const card = { number: '4242424242424242', exp_month: 12, exp_year: 2030, cvc: '123' }
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(card))))
    const pub = await crypto.subtle.importKey('jwk', key.public_key_jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aes))
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawAes))
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
    const encrypted = await fetch(`${base}/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_card: { key_id: key.key_id, ek: b64(ek), iv: b64(iv), ciphertext: b64(cipher) },
      }),
    })
    expect(encrypted.status).toBe(200)
    const body = await encrypted.json() as { token: string; card?: { number?: string } }
    expect(body.token).toMatch(/^tok_test_/)
    expect(JSON.stringify(body)).not.toContain('4242424242424242')
  })
})
