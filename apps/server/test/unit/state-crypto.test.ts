import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { PaymentIntentStatus } from '@nexus-elements/contracts'
import { assertTransition, canCancel, canConfirm, canTransition } from '../../src/services/state-machine.js'
import { SandboxChannel } from '../../src/gateway/sandbox.js'
import { redact } from '../../src/crypto/redact.js'
import { signWebhook, verifyWebhook } from '../../src/crypto/webhook.js'
import { EncryptionKeys } from '../../src/crypto/keys.js'
import { panFingerprint } from '../../src/crypto/fingerprint.js'

const STATUSES: PaymentIntentStatus[] = ['requires_payment_method', 'processing', 'requires_action', 'succeeded', 'canceled']

const INVALID: Array<[PaymentIntentStatus, PaymentIntentStatus]> = [
  ['succeeded', 'canceled'],
  ['succeeded', 'processing'],
  ['succeeded', 'requires_action'],
  ['succeeded', 'requires_payment_method'],
  ['canceled', 'succeeded'],
  ['canceled', 'processing'],
  ['canceled', 'requires_action'],
  ['canceled', 'requires_payment_method'],
  ['processing', 'processing'],
  ['requires_action', 'requires_action'],
]

describe('state machine invalid transitions', () => {
  it.each(INVALID)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
    expect(() => assertTransition(from, to)).toThrow(`Illegal payment intent transition ${from} -> ${to}`)
  })

  it.each(STATUSES)('confirm is only legal from an open status (%s)', (status) => {
    expect(canConfirm(status)).toBe(status === 'requires_payment_method' || status === 'requires_action')
  })

  it.each(STATUSES)('cancel is legal unless the intent succeeded (%s)', (status) => {
    expect(canCancel(status)).toBe(status !== 'succeeded')
  })

  it('allows the synchronous success and challenge edges', () => {
    expect(canTransition('requires_payment_method', 'succeeded')).toBe(true)
    expect(canTransition('requires_payment_method', 'requires_action')).toBe(true)
    expect(canTransition('requires_payment_method', 'processing')).toBe(true)
    expect(canTransition('requires_action', 'succeeded')).toBe(true)
    expect(canTransition('requires_action', 'requires_payment_method')).toBe(true)
    expect(canTransition('processing', 'succeeded')).toBe(true)
    expect(canTransition('processing', 'canceled')).toBe(true)
  })
})

describe('sandbox outcomes', () => {
  const gateway = new SandboxChannel()
  const base = { amount: 50, currency: 'usd', paymentMethodType: 'card', merchantId: 'acct', intentId: 'pi_test_9' }

  it('approves a success outcome', async () => {
    expect((await gateway.authorize({ ...base, outcome: { kind: 'success' } })).status).toBe('succeeded')
  })

  it('declines with the classified code', async () => {
    const result = await gateway.authorize({
      ...base,
      outcome: { kind: 'decline', code: 'expired_card', decline_code: 'expired_card', message: '您的卡已过期。' },
    })
    expect(result.status).toBe('declined')
    expect(result.decline).toEqual({ code: 'expired_card', decline_code: 'expired_card', message: '您的卡已过期。' })
  })

  it('builds a 3DS redirect and defaults a missing return url', async () => {
    const withReturn = await gateway.authorize({ ...base, returnUrl: 'https://shop.test/back', outcome: { kind: 'requires_action' } })
    expect(withReturn.redirectUrl).toContain(encodeURIComponent('https://shop.test/back'))
    const fallback = await gateway.authorize({ ...base, outcome: { kind: 'requires_action' } })
    expect(fallback.redirectUrl).toContain('/3ds-mock?intent=pi_test_9')
    expect(fallback.redirectUrl).toContain(encodeURIComponent('/'))
  })
})

describe('redaction', () => {
  it('redacts PAN, CVC, CVV, IBAN, and account numbers', () => {
    const cleaned = redact({
      number: '4242424242424242',
      cvc: '123',
      cvv: '999',
      iban: 'DE89370400440532013000',
      account_number: '000123',
      pan: '4111111111111111',
      note: 'keep',
    }) as Record<string, string>
    for (const key of ['number', 'cvc', 'cvv', 'iban', 'account_number', 'pan']) {
      expect(cleaned[key]).toBe('[redacted]')
    }
    expect(cleaned.note).toBe('keep')
  })

  it('redacts nested card objects and wrapped keys', () => {
    const cleaned = redact({ card: { number: '4242', exp_month: 12 }, encrypted_card: { ek: 'aa' }, authorization: 'Bearer sk' }) as {
      card: { number: string; exp_month: number }
      encrypted_card: string
      authorization: string
    }
    expect(cleaned.card).toEqual({ number: '[redacted]', exp_month: 12 })
    expect(cleaned.encrypted_card).toBe('[redacted]')
    expect(cleaned.authorization).toBe('[redacted]')
  })

  it('redacts client secrets and stops at max depth', () => {
    expect(redact({ client_secret: 'pi_test_1_secret_abc' })).toEqual({ client_secret: '[redacted]' })
    let nested: unknown = { leaf: 'x' }
    for (let i = 0; i < 10; i++) nested = { child: nested }
    expect(JSON.stringify(redact(nested))).toContain('[max-depth]')
    expect(redact(['a', 1])).toEqual(['a', 1])
    expect(redact(undefined)).toBeUndefined()
  })
})

describe('webhook signing', () => {
  const payload = '{"id":"evt_test_1"}'
  const header = signWebhook('whsec_unit', payload, 1_700_000_000)

  it('verifies a fresh signature', () => {
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
    expect(verifyWebhook('whsec_unit', header, payload, 1_700_000_100)).toBe(true)
  })

  it('rejects a body that was not signed', () => {
    expect(verifyWebhook('whsec_unit', header, '{"id":"evt_other"}', 1_700_000_100)).toBe(false)
  })

  it('rejects a timestamp outside the five minute window', () => {
    expect(verifyWebhook('whsec_unit', header, payload, 1_700_000_000 + 301)).toBe(false)
    expect(verifyWebhook('whsec_unit', header, payload, 1_700_000_000 - 301)).toBe(false)
  })

  it('rejects a truncated or unsigned header', () => {
    expect(verifyWebhook('whsec_unit', 't=1700000000', payload, 1_700_000_000)).toBe(false)
    expect(verifyWebhook('whsec_unit', 'v1=abcd', payload, 1_700_000_000)).toBe(false)
    expect(verifyWebhook('whsec_unit', 't=nope,v1=abcd', payload, 1_700_000_000)).toBe(false)
  })

  it('rejects a signature of the wrong length', () => {
    expect(verifyWebhook('whsec_unit', 't=1700000000,v1=abcd', payload, 1_700_000_000)).toBe(false)
  })

  it('matches HMAC-SHA256 of timestamp.payload', () => {
    const expected = createHmac('sha256', 'whsec_unit').update(`1700000000.${payload}`).digest('hex')
    expect(header.endsWith(expected)).toBe(true)
  })
})

describe('encryption failures', () => {
  const keys = new EncryptionKeys('ek_unit')

  it('rejects a mismatched key id', () => {
    expect(keys.decryptCard({ key_id: 'ek_other', ek: 'aa', iv: 'bb', ciphertext: 'cc' })).toBeNull()
  })

  it('rejects a payload missing a field', () => {
    expect(keys.decryptCard({ key_id: 'ek_unit', ek: 'aa', iv: 'bb' })).toBeNull()
  })

  it('rejects a ciphertext that is too short to hold a tag', () => {
    expect(keys.decryptCard({ key_id: 'ek_unit', ek: 'aa', iv: 'bb', ciphertext: Buffer.from('short').toString('base64') })).toBeNull()
  })

  it('rejects garbage that is not a hybrid ciphertext', () => {
    expect(keys.decryptCard({
      key_id: 'ek_unit',
      ek: Buffer.from('not-a-key').toString('base64'),
      iv: Buffer.from('123456789012').toString('base64'),
      ciphertext: Buffer.alloc(32, 7).toString('base64'),
    })).toBeNull()
  })

  it('round-trips a card and rejects a tampered tag', async () => {
    const card = { number: '4242424242424242', cvc: '123' }
    const described = keys.describe(50)
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(card))))
    const pub = await crypto.subtle.importKey('jwk', described.public_key_jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new Uint8Array(await crypto.subtle.exportKey('raw', aes))))
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
    const payload = { key_id: 'ek_unit', ek: b64(ek), iv: b64(iv), ciphertext: b64(cipher) }
    expect(keys.decryptCard(payload)).toEqual(card)
    const packed = Buffer.from(payload.ciphertext, 'base64')
    packed[packed.length - 1] ^= 0xff
    expect(keys.decryptCard({ ...payload, ciphertext: packed.toString('base64') })).toBeNull()
    expect(panFingerprint('whsec', card.number)).toHaveLength(64)
  })

  it('reloads an exported PEM', () => {
    const restored = new EncryptionKeys('ek_unit', keys.exportPrivatePem())
    expect(restored.describe(1).public_key_pem).toContain('BEGIN PUBLIC KEY')
    expect(restored.describe(1).algorithm).toBe('RSA-OAEP')
  })
})
