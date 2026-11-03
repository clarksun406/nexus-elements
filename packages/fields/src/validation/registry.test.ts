import { describe, expect, it } from 'vitest'
import { registerValidator, getValidator, validate, getRegisteredTypes, type ValidatorFn } from './registry'

describe('validator registry', () => {
  describe('built-in validators', () => {
    it('pre-registers cardNumber, cardExpiry, cardCvc, iban, bsb, postalCode', () => {
      const types = getRegisteredTypes()
      expect(types).toContain('postalCode')
      expect(validate('postalCode', '10001', { country: 'US' }).isValid).toBe(true)
      expect(validate('postalCode', 'ABC', { country: 'US' }).isValid).toBe(false)
      expect(validate('postalCode', '', { country: 'US' }).isComplete).toBe(false)
      expect(validate('postalCode', 'SW1A 1AA', { country: 'GB' }).isValid).toBe(true)
      expect(types).toContain('cardNumber')
      expect(types).toContain('cardExpiry')
      expect(types).toContain('cardCvc')
      expect(types).toContain('iban')
      expect(types).toContain('bsb')
    })

    it('validates card number via registry', () => {
      const result = validate('cardNumber', '4242 4242 4242 4242')
      expect(result.isValid).toBe(true)
      expect(result.isComplete).toBe(true)
    })

    it('validates expiry via registry', () => {
      const currentYear = new Date().getFullYear()
      const futureYY = String((currentYear + 2) % 100).padStart(2, '0')
      const result = validate('cardExpiry', `12/${futureYY}`)
      expect(result.isValid).toBe(true)
    })

    it('validates cvc with brand context', () => {
      expect(validate('cardCvc', '123', { brand: 'visa' }).isValid).toBe(true)
      expect(validate('cardCvc', '1234', { brand: 'amex' }).isValid).toBe(true)
      expect(validate('cardCvc', '1234', { brand: 'visa' }).isValid).toBe(false)
    })

    it('validates iban with default country lengths', () => {
      const result = validate('iban', 'DE89 3704 0044 0532 0130 00')
      expect(result.isValid).toBe(true)
    })

    it('validates iban with custom country lengths', () => {
      const result = validate('iban', 'DE89370400440532013000', { countryLengths: { DE: 22 } })
      expect(result.isValid).toBe(true)
    })

    it('validates bsb', () => {
      expect(validate('bsb', '123456').isValid).toBe(true)
      expect(validate('bsb', '123').isComplete).toBe(false)
    })
  })

  describe('custom validators', () => {
    it('registers and retrieves a custom validator', () => {
      const custom: ValidatorFn = (value) => ({
        isValid: value.length === 5,
        isComplete: value.length >= 5,
        error: value.length > 0 && value.length < 5
          ? { field: 'custom', type: 'length', message: 'Need 5 chars' }
          : undefined,
      })
      registerValidator('custom', custom)
      expect(getValidator('custom')).toBe(custom)
      expect(validate('custom', 'abcde').isValid).toBe(true)
      expect(validate('custom', 'abc').isComplete).toBe(false)
    })

    it('overrides a built-in validator', () => {
      const alwaysValid: ValidatorFn = () => ({ isValid: true, isComplete: true })
      registerValidator('cardNumber', alwaysValid)
      expect(validate('cardNumber', 'garbage').isValid).toBe(true)

      const original: ValidatorFn = (value) => {
        const digits = value.replace(/\D/g, '')
        if (digits.length === 0) return { isValid: false, isComplete: false }
        return { isValid: true, isComplete: true }
      }
      registerValidator('cardNumber', original)
    })
  })

  describe('unregistered type', () => {
    it('returns error for unknown type', () => {
      const result = validate('nonexistent', 'anything')
      expect(result.isValid).toBe(false)
      expect(result.error?.type).toBe('format')
      expect(result.error?.message).toContain('nonexistent')
    })

    it('returns undefined from getValidator', () => {
      expect(getValidator('nonexistent')).toBeUndefined()
    })
  })
})
