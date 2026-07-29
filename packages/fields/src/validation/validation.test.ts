import { describe, expect, it } from 'vitest'
import {
  luhnCheck,
  mod97Check,
  validateBsb,
  validateCardCvc,
  validateCardExpiry,
  validateCardNumber,
  validateIban,
} from './index'

describe('luhnCheck', () => {
  it('accepts valid card numbers', () => {
    expect(luhnCheck('4242424242424242')).toBe(true)
    expect(luhnCheck('378282246310005')).toBe(true)
    expect(luhnCheck('5555555555554444')).toBe(true)
  })

  it('rejects invalid checksums', () => {
    expect(luhnCheck('4242424242424241')).toBe(false)
    expect(luhnCheck('1234567890123456')).toBe(false)
  })
})

describe('validateCardNumber', () => {
  it('returns incomplete for empty input', () => {
    expect(validateCardNumber('')).toEqual({ isValid: false, isComplete: false })
  })

  it('accepts a valid 16-digit visa number with spaces', () => {
    const result = validateCardNumber('4242 4242 4242 4242')
    expect(result.isValid).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('accepts a valid 15-digit amex number', () => {
    const result = validateCardNumber('3782 822463 10005')
    expect(result.isValid).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('flags partial input as incomplete', () => {
    const result = validateCardNumber('424242')
    expect(result.isValid).toBe(false)
    expect(result.isComplete).toBe(false)
    expect(result.error?.type).toBe('incomplete')
  })

  it('flags luhn failure as invalid', () => {
    const result = validateCardNumber('4242424242424241')
    expect(result.isValid).toBe(false)
    expect(result.isComplete).toBe(true)
    expect(result.error?.type).toBe('luhn')
  })

  it('flags over-length input as invalid', () => {
    const result = validateCardNumber('424242424242424242424')
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('length')
  })
})

describe('validateCardExpiry', () => {
  const currentYear = new Date().getFullYear()
  const futureYY = String((currentYear + 2) % 100).padStart(2, '0')
  const farFutureYY = String((currentYear + 21) % 100).padStart(2, '0')

  it('returns incomplete for empty input', () => {
    expect(validateCardExpiry('')).toEqual({ isValid: false, isComplete: false })
  })

  it('accepts a valid future expiry', () => {
    const result = validateCardExpiry(`12/${futureYY}`)
    expect(result.isValid).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('flags partial input as incomplete', () => {
    const result = validateCardExpiry('1')
    expect(result.isComplete).toBe(false)
  })

  it('flags month 13 as format error', () => {
    const result = validateCardExpiry(`13/${futureYY}`)
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('format')
  })

  it('flags past dates as expired', () => {
    const result = validateCardExpiry('01/20')
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('expired')
  })

  it('flags dates more than 20 years out as range error', () => {
    const result = validateCardExpiry(`01/${farFutureYY}`)
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('range')
  })
})

describe('validateCardCvc', () => {
  it('returns incomplete for empty input', () => {
    expect(validateCardCvc('')).toEqual({ isValid: false, isComplete: false })
  })

  it('accepts 3 digits for visa', () => {
    expect(validateCardCvc('123', 'visa').isValid).toBe(true)
  })

  it('accepts 4 digits for amex', () => {
    expect(validateCardCvc('1234', 'amex').isValid).toBe(true)
  })

  it('flags 4 digits as too long for visa', () => {
    const result = validateCardCvc('1234', 'visa')
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('length')
  })

  it('flags 2 digits as incomplete', () => {
    const result = validateCardCvc('12', 'visa')
    expect(result.isComplete).toBe(false)
    expect(result.error?.type).toBe('incomplete')
  })
})

describe('mod97Check', () => {
  it('accepts a valid IBAN checksum', () => {
    expect(mod97Check('DE89370400440532013000')).toBe(true)
    expect(mod97Check('GB82WEST12345698765432')).toBe(true)
  })

  it('rejects a tampered IBAN', () => {
    expect(mod97Check('DE89370400440532013001')).toBe(false)
    expect(mod97Check('DE00370400440532013000')).toBe(false)
  })
})

describe('validateIban', () => {
  const lengths = { DE: 22, GB: 22 }

  it('accepts a valid German IBAN with spaces', () => {
    const result = validateIban('DE89 3704 0044 0532 0130 00', lengths)
    expect(result.isValid).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('flags unknown country codes', () => {
    const result = validateIban('XX89370400440532013000', lengths)
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('format')
  })

  it('flags short input as incomplete', () => {
    const result = validateIban('DE893704', lengths)
    expect(result.isComplete).toBe(false)
    expect(result.error?.type).toBe('incomplete')
  })

  it('flags bad checksum as mod97 error', () => {
    const result = validateIban('DE89370400440532013001', lengths)
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('mod97')
  })
})

describe('validateBsb', () => {
  it('accepts 6 digits', () => {
    expect(validateBsb('123456').isValid).toBe(true)
  })

  it('flags incomplete input', () => {
    expect(validateBsb('123').isComplete).toBe(false)
  })

  it('flags over-length input', () => {
    const result = validateBsb('1234567')
    expect(result.isValid).toBe(false)
    expect(result.error?.type).toBe('length')
  })
})
