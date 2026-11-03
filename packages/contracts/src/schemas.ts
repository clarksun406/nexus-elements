import { z } from 'zod'
import { CHECKOUT_SESSION_STATUSES, PAYMENT_INTENT_STATUSES, SETUP_INTENT_STATUSES } from './ids.js'

export const paymentIntentStatusSchema = z.enum(PAYMENT_INTENT_STATUSES)
export const setupIntentStatusSchema = z.enum(SETUP_INTENT_STATUSES)
export const checkoutSessionStatusSchema = z.enum(CHECKOUT_SESSION_STATUSES)

export const amountSchema = z.number().int().positive()

export const currencySchema = z.string().regex(/^[a-zA-Z]{3}$/)

export const billingAddressSchema = z.object({
  line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
}).passthrough()

export const billingDetailsSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: billingAddressSchema.optional(),
}).passthrough()

export const cardInputSchema = z.object({
  number: z.string(),
  exp_month: z.number().int(),
  exp_year: z.number().int(),
  cvc: z.string().min(1),
}).passthrough()

export const encryptedCardSchema = z.object({
  key_id: z.string().optional(),
  alg: z.string().optional(),
  ek: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
}).passthrough()

export const createTokenSchema = z.object({
  client_secret: z.string().optional(),
  card: cardInputSchema.optional(),
  encrypted_card: encryptedCardSchema.optional(),
  billing_details: billingDetailsSchema.optional(),
  payment_method_type: z.string().min(1).optional(),
}).passthrough()

export const createPaymentIntentSchema = z.object({
  amount: amountSchema,
  currency: currencySchema.optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(500)).optional(),
  payment_method_types: z.array(z.string()).max(20).optional(),
  receipt_email: z.string().optional(),
  capture_method: z.enum(['automatic', 'manual']).optional(),
  confirm_mode: z.string().optional(),
}).passthrough()

export const updatePaymentIntentSchema = z.object({
  amount: amountSchema.optional(),
  currency: currencySchema.optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(500)).optional(),
  receipt_email: z.string().optional(),
  payment_method_types: z.array(z.string()).max(20).optional(),
}).passthrough()

export const confirmPaymentSchema = z.object({
  payment_method_token: z.string().min(1),
  return_url: z.string().optional(),
  receipt_email: z.string().optional(),
}).passthrough()

export const createSetupIntentSchema = z.object({
  usage: z.enum(['off_session', 'on_session']).optional(),
  customer_email: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
}).passthrough()

export const confirmSetupSchema = z.object({
  payment_method_token: z.string().min(1),
  return_url: z.string().optional(),
}).passthrough()

export const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive().optional(),
  amount: z.number().int().nonnegative().optional(),
  unit_amount: z.number().int().nonnegative().optional(),
}).passthrough()

export const createCheckoutSessionSchema = z.object({
  mode: z.enum(['payment', 'subscription']).optional(),
  ui_mode: z.enum(['embedded', 'redirect']).optional(),
  amount: amountSchema,
  currency: currencySchema.optional(),
  description: z.string().optional(),
  line_items: z.array(lineItemSchema).optional(),
  success_url: z.string().optional(),
  cancel_url: z.string().optional(),
}).passthrough()

export const confirmCheckoutSchema = confirmSetupSchema

export const complete3dsSchema = z.object({
  intent: z.string().min(1),
  status: z.enum(['approved', 'failed']),
}).passthrough()

export const encryptionKeySchema = z.object({
  key_id: z.string(),
  algorithm: z.literal('RSA-OAEP'),
  public_key_jwk: z.object({ kty: z.string() }).passthrough(),
  public_key_pem: z.string().optional(),
  expires_at: z.number().int(),
})

export const apiErrorSchema = z.object({
  error: z.object({
    type: z.string(),
    code: z.string().optional(),
    message: z.string(),
    decline_code: z.string().optional(),
    payment_intent: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(),
})
