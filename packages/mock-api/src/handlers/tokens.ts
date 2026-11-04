import type { ServerResponse } from 'node:http'
import type { MockStore } from '../store.js'
import type { MockToken } from '../types.js'
import { validateCardPayload } from '@nexus-elements/contracts'
import { json, errorResponse } from '../utils.js'
import { decryptCard } from '../crypto.js'

export function handleCreateToken(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
  if (body.encrypted_card && !body.card) {
    const card = decryptCard(body.encrypted_card as { ek?: string; iv?: string; ciphertext?: string })
    if (!card) {
      return errorResponse(res, 400, 'validation_error', 'decryption_failed', '无法解密卡数据。')
    }
    body = { ...body, card }
  }
  const paymentMethodType = body.payment_method_type as string | undefined
  if (paymentMethodType) {
    const token: MockToken = {
      token: `tok_test_${++store.tokenCounter}`,
      payment_method_id: `pm_test_${store.tokenCounter}`,
      type: paymentMethodType,
      redirect_method: body[paymentMethodType] as Record<string, unknown> | undefined,
      billing_details: body.billing_details as Record<string, unknown> | undefined,
      used: false,
      expires_at: Date.now() + 5 * 60 * 1000,
    }
    store.tokens.set(token.token, token)
    store.tokens.set(token.payment_method_id, token)

    return json(res, 200, {
      token: token.token,
      payment_method_id: token.payment_method_id,
      type: paymentMethodType,
      [paymentMethodType]: token.redirect_method ?? {},
    })
  }

  const validated = validateCardPayload(body.card)
  if (!validated.ok) {
    return errorResponse(res, validated.error.status, validated.error.type, validated.error.code, validated.error.message)
  }
  const card = validated.card

  const token: MockToken = {
    token: `tok_test_${++store.tokenCounter}`,
    payment_method_id: `pm_test_${store.tokenCounter}`,
    type: 'card',
    card_number: card.number,
    brand: card.brand,
    last4: card.last4,
    exp_month: card.exp_month,
    exp_year: card.exp_year,
    billing_details: body.billing_details as Record<string, unknown> | undefined,
    used: false,
    expires_at: Date.now() + 5 * 60 * 1000,
  }
  store.tokens.set(token.token, token)
  store.tokens.set(token.payment_method_id, token)

  return json(res, 200, {
    token: token.token,
    payment_method_id: token.payment_method_id,
    type: 'card',
    card: {
      brand: token.brand,
      last4: token.last4,
      exp_month: token.exp_month,
      exp_year: token.exp_year,
      funding: 'credit',
      country: 'US',
    },
  })
}
