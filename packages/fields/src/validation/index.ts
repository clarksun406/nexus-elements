import type { CardBrand } from './brands'
import { getBrandRule } from './brands'

export interface ValidationError {
  field: string
  type: 'required' | 'format' | 'length' | 'range' | 'luhn' | 'mod97' | 'expired' | 'incomplete'
  message: string
}

export interface ValidationResult {
  isValid: boolean
  isComplete: boolean
  error?: ValidationError
}

export function luhnCheck(digits: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

export function validateCardNumber(value: string, messages?: ValidationMessages): ValidationResult {
  const digits = value.replace(/\D/g, '')
  const rule = getBrandRule(digits)

  if (digits.length === 0) {
    return { isValid: false, isComplete: false }
  }

  const maxLength = Math.max(...rule.lengths)
  if (digits.length > maxLength) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardNumber', type: 'length', message: messages?.cardInvalid ?? 'Your card number is invalid.' },
    }
  }

  if (!rule.lengths.includes(digits.length)) {
    return {
      isValid: false,
      isComplete: false,
      error: { field: 'cardNumber', type: 'incomplete', message: messages?.cardIncomplete ?? 'Your card number is incomplete.' },
    }
  }

  if (rule.luhn && !luhnCheck(digits)) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardNumber', type: 'luhn', message: messages?.cardInvalid ?? 'Your card number is invalid.' },
    }
  }

  return { isValid: true, isComplete: true }
}

export function validateCardExpiry(value: string, messages?: ValidationMessages): ValidationResult {
  const digits = value.replace(/\D/g, '')

  if (digits.length === 0) {
    return { isValid: false, isComplete: false }
  }

  if (digits.length < 4) {
    return {
      isValid: false,
      isComplete: false,
      error: { field: 'cardExpiry', type: 'incomplete', message: messages?.expiryIncomplete ?? "Your card's expiration date is incomplete." },
    }
  }

  const month = parseInt(digits.slice(0, 2), 10)
  const year = 2000 + parseInt(digits.slice(2, 4), 10)

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardExpiry', type: 'format', message: messages?.expiryInvalid ?? "Your card's expiration date is invalid." },
    }
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardExpiry', type: 'expired', message: messages?.expiryPast ?? "Your card's expiration date is in the past." },
    }
  }

  if (year > currentYear + 20) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardExpiry', type: 'range', message: messages?.expiryInvalid ?? "Your card's expiration date is invalid." },
    }
  }

  return { isValid: true, isComplete: true }
}

export function validateCardCvc(value: string, brand: CardBrand = 'unknown', messages?: ValidationMessages): ValidationResult {
  const digits = value.replace(/\D/g, '')
  const rule = getBrandRule(brand === 'unknown' ? '' : brand)
  const requiredLength = rule.cvcLength

  if (digits.length === 0) {
    return { isValid: false, isComplete: false }
  }

  if (digits.length < requiredLength) {
    return {
      isValid: false,
      isComplete: false,
      error: { field: 'cardCvc', type: 'incomplete', message: messages?.cvcIncomplete ?? "Your card's security code is incomplete." },
    }
  }

  if (digits.length > requiredLength) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'cardCvc', type: 'length', message: messages?.cvcInvalid ?? "Your card's security code is invalid." },
    }
  }

  return { isValid: true, isComplete: true }
}

export function mod97Check(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = ''
  for (const char of rearranged) {
    const value = char >= 'A' && char <= 'Z' ? (char.charCodeAt(0) - 55).toString() : char
    remainder += value
    let num = parseInt(remainder, 10)
    remainder = (num % 97).toString()
  }
  return parseInt(remainder, 10) === 1
}

export function validateIban(value: string, countryLengths: Record<string, number>, messages?: ValidationMessages): ValidationResult {
  const compact = value.replace(/\s/g, '').toUpperCase()

  if (compact.length === 0) {
    return { isValid: false, isComplete: false }
  }

  if (compact.length < 2) {
    return {
      isValid: false,
      isComplete: false,
      error: { field: 'iban', type: 'incomplete', message: messages?.ibanIncomplete ?? 'IBAN is incomplete.' },
    }
  }

  const countryCode = compact.slice(0, 2)
  const expectedLength = countryLengths[countryCode]

  if (!expectedLength) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'iban', type: 'format', message: messages?.ibanInvalid ?? 'Invalid IBAN.' },
    }
  }

  if (compact.length < expectedLength) {
    return {
      isValid: false,
      isComplete: false,
      error: { field: 'iban', type: 'incomplete', message: messages?.ibanIncomplete ?? 'IBAN is incomplete.' },
    }
  }

  if (compact.length > expectedLength || !mod97Check(compact)) {
    return {
      isValid: false,
      isComplete: true,
      error: { field: 'iban', type: 'mod97', message: messages?.ibanInvalid ?? 'Invalid IBAN.' },
    }
  }

  return { isValid: true, isComplete: true }
}

export function validateBsb(value: string): ValidationResult {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return { isValid: false, isComplete: false }
  if (digits.length < 6) {
    return { isValid: false, isComplete: false, error: { field: 'bsb', type: 'incomplete', message: 'BSB number is incomplete.' } }
  }
  if (digits.length > 6) {
    return { isValid: false, isComplete: true, error: { field: 'bsb', type: 'length', message: 'BSB number is invalid.' } }
  }
  return { isValid: true, isComplete: true }
}

export interface ValidationMessages {
  cardInvalid?: string
  cardIncomplete?: string
  expiryInvalid?: string
  expiryIncomplete?: string
  expiryPast?: string
  cvcInvalid?: string
  cvcIncomplete?: string
  ibanInvalid?: string
  ibanIncomplete?: string
}

export { registerValidator, getValidator, validate, getRegisteredTypes } from './registry'
export type { ValidatorFn, ValidatorContext } from './registry'
