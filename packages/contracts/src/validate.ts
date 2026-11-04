import { amountSchema } from './schemas.js'
import { brandCountry, cardExpired, detectBrand, luhnValid } from './cards.js'
import { fieldError, type FieldError } from './errors.js'

export interface NormalizedCard {
  number: string
  exp_month: number
  exp_year: number
  cvc: string
  brand: string
  last4: string
  funding: 'credit'
  country: 'US'
}

export function validateAmount(amount: unknown): { ok: true; amount: number } | { ok: false; error: FieldError } {
  const parsed = amountSchema.safeParse(amount)
  if (!parsed.success) {
    return fieldError(400, 'validation_error', 'invalid_amount', '金额必须为正整数（最小单位）。')
  }
  return { ok: true, amount: parsed.data }
}

export function normalizeCurrency(currency: unknown): string {
  if (typeof currency === 'string' && currency.trim()) return currency.trim().toLowerCase()
  return 'cny'
}

/**
 * Same precedence as the mock API: empty number, Luhn/length, missing expiry
 * or CVC, then expiry in the past.
 */
export function validateCardPayload(card: unknown, now = new Date()): { ok: true; card: NormalizedCard } | { ok: false; error: FieldError } {
  if (!card || typeof card !== 'object') {
    return fieldError(400, 'validation_error', 'invalid_number', '卡号不能为空。')
  }
  const raw = card as { number?: unknown; exp_month?: unknown; exp_year?: unknown; cvc?: unknown }
  if (typeof raw.number !== 'string' || raw.number.trim() === '') {
    return fieldError(400, 'validation_error', 'invalid_number', '卡号不能为空。')
  }
  const number = raw.number.replace(/\D/g, '')
  if (number.length < 13 || number.length > 19 || !luhnValid(number)) {
    return fieldError(400, 'validation_error', 'invalid_number', '卡号无效，请检查后重试。')
  }
  if (typeof raw.exp_month !== 'number' || typeof raw.exp_year !== 'number' || typeof raw.cvc !== 'string' || raw.cvc.length === 0) {
    return fieldError(400, 'validation_error', 'incomplete_card', '银行卡信息不完整：缺少有效期或安全码。')
  }
  if (cardExpired(raw.exp_month, raw.exp_year, now)) {
    return fieldError(400, 'validation_error', 'invalid_expiry', '您的卡已过期。')
  }
  const meta = brandCountry(number)
  return {
    ok: true,
    card: {
      number,
      exp_month: raw.exp_month,
      exp_year: raw.exp_year,
      cvc: raw.cvc,
      brand: detectBrand(number),
      last4: number.slice(-4),
      funding: meta.funding,
      country: meta.country,
    },
  }
}

export const UPDATABLE_INTENT_FIELDS = ['amount', 'currency', 'description', 'metadata', 'receipt_email', 'payment_method_types'] as const

export function updateTouchesRestrictedFields(body: Record<string, unknown>): boolean {
  return Boolean(body.amount || body.currency || body.payment_method_types)
}
