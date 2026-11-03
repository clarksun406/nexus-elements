import type { CardBrand } from './brands'
import type { ValidationResult } from './index'
import {
  validateCardNumber,
  validateCardExpiry,
  validateCardCvc,
  validateIban,
  validateBsb,
} from './index'
import { IBAN_COUNTRY_LENGTHS } from '../bank-data'

export interface ValidatorContext {
  brand?: CardBrand
  country?: string
  countryLengths?: Record<string, number>
  messages?: Record<string, string>
}

export type ValidatorFn = (value: string, context?: ValidatorContext) => ValidationResult

const registry = new Map<string, ValidatorFn>()

export function registerValidator(type: string, fn: ValidatorFn): void {
  registry.set(type, fn)
}

export function getValidator(type: string): ValidatorFn | undefined {
  return registry.get(type)
}

export function validate(type: string, value: string, context?: ValidatorContext): ValidationResult {
  const fn = registry.get(type)
  if (!fn) {
    return { isValid: false, isComplete: false, error: { field: type, type: 'format', message: `No validator registered for "${type}".` } }
  }
  return fn(value, context)
}

export function getRegisteredTypes(): string[] {
  return [...registry.keys()]
}

registerValidator('cardNumber', (value, ctx) =>
  validateCardNumber(value, ctx?.messages),
)

registerValidator('cardExpiry', (value, ctx) =>
  validateCardExpiry(value, ctx?.messages),
)

registerValidator('cardCvc', (value, ctx) =>
  validateCardCvc(value, ctx?.brand, ctx?.messages),
)

registerValidator('iban', (value, ctx) =>
  validateIban(value, ctx?.countryLengths ?? IBAN_COUNTRY_LENGTHS, ctx?.messages),
)

registerValidator('bsb', (value) =>
  validateBsb(value),
)

const POSTAL_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CN: /^\d{6}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  CA: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  AU: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
  NL: /^\d{4}\s*[A-Z]{2}$/i,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  BR: /^\d{5}-?\d{3}$/,
  IN: /^\d{6}$/,
  PL: /^\d{2}-\d{3}$/,
}

registerValidator('postalCode', (value, ctx) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return { isValid: false, isComplete: false, error: { field: 'postalCode', type: 'incomplete', message: ctx?.messages?.postalInvalid ?? 'Your postal code is incomplete.' } }
  }
  const country = (ctx?.country ?? 'US').toUpperCase()
  const pattern = POSTAL_PATTERNS[country]
  if (pattern && !pattern.test(trimmed)) {
    return { isValid: false, isComplete: true, error: { field: 'postalCode', type: 'format', message: ctx?.messages?.postalInvalid ?? 'Your postal code is invalid.' } }
  }
  return { isValid: true, isComplete: true }
})
