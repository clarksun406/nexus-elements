import { describe, expect, it } from 'vitest'
import { detectBrand, formatBsb, formatCardNumber, formatCvc, formatExpiry, formatIban } from './format'

describe('formatCardNumber', () => {
  it('formats visa in 4-4-4-4 groups', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242')
  })

  it('formats amex in 4-6-5 groups', () => {
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005')
  })

  it('formats partial input without trailing space', () => {
    expect(formatCardNumber('424242')).toBe('4242 42')
  })

  it('strips non-digits and trims to max brand length', () => {
    expect(formatCardNumber('3782-8224-6310-0059-99')).toBe('3782 822463 10005')
  })
})

describe('formatExpiry', () => {
  it('keeps a single low digit as-is', () => {
    expect(formatExpiry('1')).toBe('1')
  })

  it('zero-pads a single high digit', () => {
    expect(formatExpiry('2')).toBe('02/')
  })

  it('appends slash after a valid month', () => {
    expect(formatExpiry('12')).toBe('12/')
  })

  it('splits month > 12 into 0M/M', () => {
    expect(formatExpiry('13')).toBe('01/3')
  })

  it('collapses month 00 to 0', () => {
    expect(formatExpiry('00')).toBe('0')
  })

  it('formats full MMYY', () => {
    expect(formatExpiry('1228')).toBe('12/28')
  })

  it('truncates beyond 4 digits', () => {
    expect(formatExpiry('122888')).toBe('12/28')
  })
})

describe('formatCvc', () => {
  it('truncates to 3 digits for visa', () => {
    expect(formatCvc('1234', 'visa')).toBe('123')
  })

  it('keeps 4 digits for amex', () => {
    expect(formatCvc('1234', 'amex')).toBe('1234')
  })

  it('strips non-digits', () => {
    expect(formatCvc('1a2b3', 'visa')).toBe('123')
  })
})

describe('formatIban', () => {
  it('uppercases and groups in fours', () => {
    expect(formatIban('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })

  it('regroups already-spaced input', () => {
    expect(formatIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 3704 0044 0532 0130 00')
  })
})

describe('formatBsb', () => {
  it('formats 6 digits as XXX-XXX', () => {
    expect(formatBsb('123456')).toBe('123-456')
  })

  it('keeps short input ungrouped', () => {
    expect(formatBsb('123')).toBe('123')
  })
})

describe('detectBrand', () => {
  it.each([
    ['4242424242424242', 'visa'],
    ['378282246310005', 'amex'],
    ['5555555555554444', 'mastercard'],
    ['2223000048400011', 'mastercard'],
    ['6011111111111117', 'discover'],
    ['3530111333300000', 'jcb'],
    ['6200000000000005', 'unionpay'],
    ['30569309025904', 'diners'],
  ] as const)('detects %s as %s', (number, brand) => {
    expect(detectBrand(number)).toBe(brand)
  })

  it('returns unknown for empty input', () => {
    expect(detectBrand('')).toBe('unknown')
  })
})
