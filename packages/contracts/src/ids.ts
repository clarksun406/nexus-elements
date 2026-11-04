export const PAYMENT_INTENT_STATUSES = [
  'requires_payment_method',
  'processing',
  'requires_action',
  'succeeded',
  'canceled',
] as const
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number]

export const SETUP_INTENT_STATUSES = [
  'requires_payment_method',
  'requires_action',
  'succeeded',
  'canceled',
] as const
export type SetupIntentStatus = (typeof SETUP_INTENT_STATUSES)[number]

export const CHECKOUT_SESSION_STATUSES = ['open', 'complete', 'expired'] as const
export type CheckoutSessionStatus = (typeof CHECKOUT_SESSION_STATUSES)[number]

export const TOKEN_TTL_MS = 5 * 60 * 1000

export type KeyMode = 'test' | 'live'

export function modeFromKey(key: string): KeyMode | null {
  if (key.startsWith('pk_test_') || key.startsWith('sk_test_')) return 'test'
  if (key.startsWith('pk_live_') || key.startsWith('sk_live_')) return 'live'
  return null
}

export function isPublishableKey(key: string): boolean {
  return key.startsWith('pk_test_') || key.startsWith('pk_live_')
}

export function isSecretKey(key: string): boolean {
  return key.startsWith('sk_test_') || key.startsWith('sk_live_')
}

export function resourceId(prefix: 'pi' | 'tok' | 'pm' | 'seti' | 'cs' | 'evt', mode: KeyMode, n: number): string {
  return `${prefix}_${mode}_${n}`
}

export function clientSecretFor(id: string, secret: string): string {
  return `${id}_secret_${secret}`
}

export function idFromClientSecret(clientSecret: string): string {
  const index = clientSecret.indexOf('_secret_')
  return index === -1 ? clientSecret : clientSecret.slice(0, index)
}
