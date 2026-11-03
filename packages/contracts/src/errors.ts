export const ERROR_TYPES = ['card_error', 'api_error', 'validation_error', 'network_error'] as const
export type ErrorType = (typeof ERROR_TYPES)[number]

export const ERROR_CODES = [
  'card_declined',
  'insufficient_funds',
  'expired_card',
  'incorrect_cvc',
  'processing_error',
  'invalid_amount',
  'invalid_number',
  'incomplete_card',
  'invalid_expiry',
  'invalid_token',
  'token_already_used',
  'token_expired',
  'decryption_failed',
  'resource_missing',
  'payment_intent_already_confirmed',
  'payment_intent_unexpected_state',
  'setup_intent_already_confirmed',
  'invalid_client_secret',
  'session_not_open',
  'invalid_api_key',
  'account_invalid',
  'idempotency_key_in_use',
  'idempotency_key_in_progress',
  'rate_limited',
  'unknown_endpoint',
  'invalid_json',
  'internal_error',
  'apple_pay_unavailable',
  'publishable_key_not_allowed',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiErrorBody {
  type: ErrorType | string
  code?: string
  message: string
  decline_code?: string
  payment_intent?: Record<string, unknown>
  [key: string]: unknown
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody
}

export interface FieldError {
  status: number
  type: ErrorType
  code: string
  message: string
}

export function fieldError(status: number, type: ErrorType, code: string, message: string): { ok: false; error: FieldError } {
  return { ok: false, error: { status, type, code, message } }
}
