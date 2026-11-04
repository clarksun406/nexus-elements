import type { FieldError } from './errors.js'

export const DECLINE_CARDS: Record<string, { code: string; decline_code: string; message: string }> = {
  '4000000000009995': { code: 'card_declined', decline_code: 'insufficient_funds', message: '您的卡余额不足，请更换支付方式。' },
  '4000000000000002': { code: 'card_declined', decline_code: 'generic_decline', message: '您的卡被拒绝，请联系发卡行。' },
  '4000000000000069': { code: 'expired_card', decline_code: 'expired_card', message: '您的卡已过期。' },
  '4000000000000127': { code: 'incorrect_cvc', decline_code: 'incorrect_cvc', message: '您的卡安全码错误。' },
}

export const THREE_DS_CARD = '4000000000003220'

export const SUCCESS_CARDS = [
  '4242424242424242',
  '5555555555554444',
  '378282246310005',
  '6200000000000005',
] as const

export const SAVED_PAYMENT_METHODS = [
  { id: 'pm_saved_1', object: 'payment_method' as const, type: 'card' as const, card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 } },
  { id: 'pm_saved_2', object: 'payment_method' as const, type: 'card' as const, card: { brand: 'mastercard', last4: '4444', exp_month: 6, exp_year: 2027 } },
]

export type CardOutcome =
  | { kind: 'success' }
  | { kind: 'requires_action' }
  | { kind: 'decline'; code: string; decline_code: string; message: string }

export function classifyPan(number: string): CardOutcome {
  if (number === THREE_DS_CARD) return { kind: 'requires_action' }
  const decline = DECLINE_CARDS[number]
  if (decline) return { kind: 'decline', ...decline }
  return { kind: 'success' }
}

export function detectBrand(number: string): string {
  if (number.startsWith('4')) return 'visa'
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard'
  if (/^3[47]/.test(number)) return 'amex'
  if (/^62/.test(number)) return 'unionpay'
  if (/^35/.test(number)) return 'jcb'
  return 'unknown'
}

export function luhnValid(number: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = number.length - 1; i >= 0; i--) {
    let n = number.charCodeAt(i) - 48
    if (n < 0 || n > 9) return false
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return number.length > 0 && sum % 10 === 0
}

/**
 * Card is valid through the stated month. `Date` treats month as 0-based and
 * rolls month 12 into January of the next year, which matches the mock API.
 */
export function cardExpired(expMonth: number, expYear: number, now = new Date()): boolean {
  return new Date(expYear, expMonth) <= now
}

export function brandCountry(_number: string): { funding: 'credit'; country: 'US' } {
  return { funding: 'credit', country: 'US' }
}

export type { FieldError }
