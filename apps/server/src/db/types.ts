import type { CardOutcome, CheckoutSessionStatus, PaymentIntentStatus, SetupIntentStatus } from '@nexus-elements/contracts'

export interface PaymentIntentRecord {
  id: string
  merchantId: string
  amount: number
  currency: string
  status: PaymentIntentStatus
  clientSecret: string
  description?: string
  metadata?: Record<string, string>
  paymentMethodTypes: string[]
  paymentMethod?: string
  receiptEmail?: string
  captureMethod?: string
  created: number
}

export interface SetupIntentRecord {
  id: string
  merchantId: string
  status: SetupIntentStatus
  clientSecret: string
  usage: string
  customerEmail?: string
  paymentMethod?: string
  created: number
}

export interface LineItem {
  name: string
  quantity?: number
  amount?: number
  unit_amount?: number
  [key: string]: unknown
}

export interface CheckoutSessionRecord {
  id: string
  merchantId: string
  status: CheckoutSessionStatus
  mode: string
  uiMode: string
  amount: number
  currency: string
  lineItems: LineItem[]
  successUrl?: string
  cancelUrl?: string
  clientSecret: string
  url: string
  paymentIntent?: string
  created: number
}

export interface TokenRecord {
  token: string
  paymentMethodId: string
  merchantId: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  funding?: string
  country?: string
  outcome: CardOutcome
  panFingerprint?: string
  redirectMethod?: Record<string, unknown>
  billingDetails?: Record<string, unknown>
  used: boolean
  expiresAt: number
}

export interface PaymentMethodRecord {
  id: string
  merchantId: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  billingDetails?: Record<string, unknown>
  customerEmail?: string
}

export interface OrderRecord {
  id: string
  merchantId: string
  body: Record<string, unknown>
}

export interface WebhookEventRecord {
  id: string
  merchantId: string
  type: string
  payload: Record<string, unknown>
  created: number
}

export interface IdempotencyStart {
  merchantId: string
  key: string
  method: string
  path: string
  requestHash: string
}

export type IdempotencyClaim =
  | { state: 'started' }
  | { state: 'replay'; status: number; body: unknown }
  | { state: 'conflict'; code: 'idempotency_key_in_use' | 'idempotency_key_in_progress'; message: string }

export interface Repository {
  nextSequence(name: 'pi' | 'tok' | 'pm' | 'seti' | 'cs' | 'evt'): Promise<number>
  insertPaymentIntent(row: PaymentIntentRecord): Promise<void>
  findPaymentIntentById(id: string): Promise<PaymentIntentRecord | null>
  findPaymentIntentBySecret(secret: string): Promise<PaymentIntentRecord | null>
  savePaymentIntent(row: PaymentIntentRecord): Promise<void>
  insertSetupIntent(row: SetupIntentRecord): Promise<void>
  findSetupIntentBySecret(secret: string): Promise<SetupIntentRecord | null>
  saveSetupIntent(row: SetupIntentRecord): Promise<void>
  insertCheckoutSession(row: CheckoutSessionRecord): Promise<void>
  findCheckoutSessionById(id: string): Promise<CheckoutSessionRecord | null>
  saveCheckoutSession(row: CheckoutSessionRecord): Promise<void>
  insertToken(row: TokenRecord): Promise<void>
  findToken(key: string): Promise<TokenRecord | null>
  markTokenUsed(token: string): Promise<boolean>
  upsertOrder(row: OrderRecord): Promise<void>
  findOrder(merchantId: string, id: string): Promise<OrderRecord | null>
  insertPaymentMethod(row: PaymentMethodRecord): Promise<void>
  listPaymentMethods(merchantId: string): Promise<PaymentMethodRecord[]>
  beginIdempotency(input: IdempotencyStart): Promise<IdempotencyClaim>
  finishIdempotency(merchantId: string, key: string, status: number, body: unknown): Promise<void>
  abortIdempotency(merchantId: string, key: string): Promise<void>
  insertWebhookEvent(row: WebhookEventRecord): Promise<void>
  listWebhookEvents(merchantId: string): Promise<WebhookEventRecord[]>
  getEncryptionPrivateKey(keyId: string): Promise<string | null>
  saveEncryptionPrivateKey(keyId: string, pem: string): Promise<void>
  containsRawValue(value: string): Promise<boolean>
  resetBusinessData(): Promise<void>
  close(): Promise<void>
}
