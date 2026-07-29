import type { ServerResponse } from 'node:http'
import type { MockStore } from '../store.js'
import type { MockToken } from '../types.js'
import { detectBrand, luhnValid, json, errorResponse } from '../utils.js'

export function handleCreateToken(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
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

  const card = body.card as { number?: string; exp_month?: number; exp_year?: number; cvc?: string } | undefined

  if (!card?.number) {
    return errorResponse(res, 400, 'validation_error', 'invalid_number', '卡号不能为空。')
  }

  const number = card.number.replace(/\D/g, '')
  if (number.length < 13 || number.length > 19 || !luhnValid(number)) {
    return errorResponse(res, 400, 'validation_error', 'invalid_number', '卡号无效，请检查后重试。')
  }

  if (card.exp_month === undefined || card.exp_year === undefined || !card.cvc) {
    return errorResponse(res, 400, 'validation_error', 'incomplete_card', '银行卡信息不完整：缺少有效期或安全码。')
  }

  const now = new Date()
  if (card.exp_month !== undefined && card.exp_year !== undefined) {
    const expiry = new Date(card.exp_year, card.exp_month)
    if (expiry <= now) {
      return errorResponse(res, 400, 'validation_error', 'invalid_expiry', '您的卡已过期。')
    }
  }

  const token: MockToken = {
    token: `tok_test_${++store.tokenCounter}`,
    payment_method_id: `pm_test_${store.tokenCounter}`,
    type: 'card',
    card_number: number,
    brand: detectBrand(number),
    last4: number.slice(-4),
    exp_month: card.exp_month ?? 12,
    exp_year: card.exp_year ?? now.getFullYear() + 2,
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
