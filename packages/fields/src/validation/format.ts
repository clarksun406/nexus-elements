import type { CardBrand } from './brands'
import { getBrandRule } from './brands'

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  const rule = getBrandRule(digits)
  const maxLength = Math.max(...rule.lengths)
  const trimmed = digits.slice(0, maxLength)

  let result = ''
  for (let i = 0; i < trimmed.length; i++) {
    if (rule.gaps.includes(i) && i > 0) {
      result += ' '
    }
    result += trimmed[i]
  }
  return result
}

export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)

  if (digits.length === 0) return ''
  if (digits.length === 1) {
    if (parseInt(digits, 10) > 1) return `0${digits}/`
    return digits
  }
  if (digits.length === 2) {
    const month = parseInt(digits, 10)
    if (month === 0) return '0'
    if (month > 12) return `0${digits[0]}/${digits[1]}`
    return `${digits}/`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatCvc(value: string, brand: CardBrand = 'unknown'): string {
  const rule = getBrandRule(brand === 'unknown' ? '' : brand)
  return value.replace(/\D/g, '').slice(0, rule.cvcLength)
}

export function formatIban(value: string): string {
  const compact = value.replace(/\s/g, '').toUpperCase().slice(0, 34)
  const groups = compact.match(/.{1,4}/g)
  return groups ? groups.join(' ') : ''
}

export function formatBsb(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)}-${digits.slice(3)}`
}

export function detectBrand(value: string): CardBrand {
  const digits = value.replace(/\D/g, '')
  return getBrandRule(digits).brand
}
