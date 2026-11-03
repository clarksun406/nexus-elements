import type { CheckoutSessionRecord, PaymentIntentRecord, PaymentMethodRecord, SetupIntentRecord, TokenRecord } from '../db/types.js'

export function publicPaymentIntent(row: PaymentIntentRecord): Record<string, unknown> {
  return {
    id: row.id,
    object: 'payment_intent',
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    client_secret: row.clientSecret,
    ...(row.description !== undefined ? { description: row.description } : {}),
    ...(row.metadata !== undefined ? { metadata: row.metadata } : {}),
    payment_method_types: row.paymentMethodTypes,
    ...(row.paymentMethod ? { payment_method: row.paymentMethod } : {}),
    ...(row.receiptEmail ? { receipt_email: row.receiptEmail } : {}),
    ...(row.captureMethod ? { capture_method: row.captureMethod } : {}),
    created: row.created,
  }
}

export function publicSetupIntent(row: SetupIntentRecord): Record<string, unknown> {
  return {
    id: row.id,
    object: 'setup_intent',
    status: row.status,
    client_secret: row.clientSecret,
    usage: row.usage,
    ...(row.customerEmail ? { customer_email: row.customerEmail } : {}),
    ...(row.paymentMethod ? { payment_method: row.paymentMethod } : {}),
    created: row.created,
  }
}

export function publicCheckoutSession(row: CheckoutSessionRecord): Record<string, unknown> {
  return {
    id: row.id,
    object: 'checkout.session',
    status: row.status,
    mode: row.mode,
    ui_mode: row.uiMode,
    amount: row.amount,
    currency: row.currency,
    line_items: row.lineItems,
    ...(row.successUrl ? { success_url: row.successUrl } : {}),
    ...(row.cancelUrl ? { cancel_url: row.cancelUrl } : {}),
    client_secret: row.clientSecret,
    url: row.url,
    ...(row.paymentIntent ? { payment_intent: row.paymentIntent } : {}),
    created: row.created,
  }
}

export function publicToken(row: TokenRecord): Record<string, unknown> {
  if (row.type !== 'card') {
    return {
      token: row.token,
      payment_method_id: row.paymentMethodId,
      type: row.type,
      [row.type]: row.redirectMethod ?? {},
    }
  }
  return {
    token: row.token,
    payment_method_id: row.paymentMethodId,
    type: 'card',
    card: {
      brand: row.brand,
      last4: row.last4,
      exp_month: row.expMonth,
      exp_year: row.expYear,
      funding: row.funding ?? 'credit',
      country: row.country ?? 'US',
    },
  }
}

export function publicPaymentMethod(row: PaymentMethodRecord): Record<string, unknown> {
  return {
    id: row.id,
    object: 'payment_method',
    type: row.type,
    card: {
      brand: row.brand,
      last4: row.last4,
      exp_month: row.expMonth,
      exp_year: row.expYear,
    },
  }
}
