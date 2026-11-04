import { describe, expect, it } from 'vitest'
import {
  DECLINE_CARDS,
  SUCCESS_CARDS,
  THREE_DS_CARD,
  apiErrorSchema,
  classifyPan,
  createPaymentIntentSchema,
  detectBrand,
  encryptionKeySchema,
  luhnValid,
  normalizeCurrency,
  validateAmount,
  validateCardPayload,
} from './index.js'

describe('cards', () => {
  it('accepts every documented test PAN and classifies outcomes', () => {
    for (const pan of SUCCESS_CARDS) {
      expect(luhnValid(pan)).toBe(true)
      expect(classifyPan(pan).kind).toBe('success')
    }
    expect(luhnValid(THREE_DS_CARD)).toBe(true)
    expect(classifyPan(THREE_DS_CARD).kind).toBe('requires_action')
    for (const pan of Object.keys(DECLINE_CARDS)) {
      expect(luhnValid(pan)).toBe(true)
      expect(classifyPan(pan).kind).toBe('decline')
    }
    expect(detectBrand('4242424242424242')).toBe('visa')
    expect(detectBrand('5555555555554444')).toBe('mastercard')
    expect(detectBrand('378282246310005')).toBe('amex')
    expect(detectBrand('6200000000000005')).toBe('unionpay')
    expect(detectBrand('3528000000000000')).toBe('jcb')
    expect(detectBrand('9999999999999995')).toBe('unknown')
    expect(luhnValid('4242424242424243')).toBe(false)
    expect(luhnValid('')).toBe(false)
    expect(luhnValid('4242abcd4242')).toBe(false)
  })
})

describe('validateAmount', () => {
  it('rejects non-positive and non-integer amounts with the mock message', () => {
    expect(validateAmount(9900)).toEqual({ ok: true, amount: 9900 })
    for (const value of [0, -1, 1.5, '100', null, undefined]) {
      const result = validateAmount(value)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('invalid_amount')
        expect(result.error.message).toContain('正整数')
      }
    }
  })
})

describe('validateCardPayload', () => {
  const future = { exp_month: 12, exp_year: 2035, cvc: '123' }

  it('follows mock error precedence', () => {
    expect(validateCardPayload(undefined).ok).toBe(false)
    expect(validateCardPayload({ number: '' }).ok).toBe(false)
    const bad = validateCardPayload({ number: '4242', ...future })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.code).toBe('invalid_number')
    const incomplete = validateCardPayload({ number: '4242424242424242', exp_month: 12 })
    expect(incomplete.ok).toBe(false)
    if (!incomplete.ok) expect(incomplete.error.code).toBe('incomplete_card')
    const expired = validateCardPayload({ number: '4242424242424242', exp_month: 1, exp_year: 2020, cvc: '123' })
    expect(expired.ok).toBe(false)
    if (!expired.ok) expect(expired.error.code).toBe('invalid_expiry')
    const ok = validateCardPayload({ number: '4242 4242 4242 4242', ...future })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.card.number).toBe('4242424242424242')
      expect(ok.card.last4).toBe('4242')
      expect(ok.card.brand).toBe('visa')
      expect(ok.card.cvc).toBe('123')
    }
  })
})

describe('schemas', () => {
  it('accepts the documented create-intent and encryption-key shapes', () => {
    expect(createPaymentIntentSchema.safeParse({ amount: 9900, currency: 'cny', metadata: { order_id: '1' } }).success).toBe(true)
    expect(createPaymentIntentSchema.safeParse({ amount: 0 }).success).toBe(false)
    expect(normalizeCurrency('USD')).toBe('usd')
    expect(normalizeCurrency(undefined)).toBe('cny')
    const key = encryptionKeySchema.safeParse({
      key_id: 'ek_test',
      algorithm: 'RSA-OAEP',
      public_key_jwk: { kty: 'RSA', n: 'x', e: 'AQAB' },
      expires_at: 1,
    })
    expect(key.success).toBe(true)
    expect(encryptionKeySchema.safeParse({ key_id: 'ek', algorithm: 'RSA-OAEP-256', public_key_jwk: { kty: 'RSA' }, expires_at: 1 }).success).toBe(false)
    expect(apiErrorSchema.safeParse({ error: { type: 'card_error', code: 'card_declined', message: 'no' } }).success).toBe(true)
  })
})
