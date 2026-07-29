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
