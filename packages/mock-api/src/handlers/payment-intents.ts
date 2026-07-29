import type { ServerResponse } from 'node:http'
import type { MockStore } from '../store.js'
import type { MockToken, MockPaymentIntent } from '../types.js'
import { DECLINE_CARDS, THREE_DS_CARD, SAVED_PAYMENT_METHODS } from '../constants.js'
import { json, errorResponse } from '../utils.js'

export function validateAndConsumeToken(
  store: MockStore,
  tokenKey: string,
  res: ServerResponse,
): MockToken | null {
  const token = tokenKey ? store.tokens.get(tokenKey) : undefined

  if (!token) {
    errorResponse(res, 400, 'validation_error', 'invalid_token', '支付 token 无效或已过期。')
    return null
  }

  if (token.used) {
    errorResponse(res, 400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。')
    return null
  }

  if (Date.now() > token.expires_at) {
    errorResponse(res, 400, 'validation_error', 'token_expired', 'token 已过期（5分钟有效），请重新提交卡信息。')
    return null
  }

  token.used = true
  return token
}

export function handleCreatePaymentIntent(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
  const amount = body.amount as number
  const currency = body.currency as string

  if (!amount || !Number.isInteger(amount) || amount <= 0) {
    return errorResponse(res, 400, 'validation_error', 'invalid_amount', '金额必须为正整数（最小单位）。')
  }

  const intent: MockPaymentIntent = {
    id: `pi_test_${++store.intentCounter}`,
    object: 'payment_intent',
    amount,
    currency: currency ?? 'cny',
    status: 'requires_payment_method',
    client_secret: `pi_test_${store.intentCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
    description: body.description as string | undefined,
    metadata: body.metadata as Record<string, string> | undefined,
    payment_method_types: (body.payment_method_types as string[]) ?? ['card'],
    created: Math.floor(Date.now() / 1000),
  }
  store.intents.set(intent.id, intent)
  store.intents.set(intent.client_secret, intent)

  return json(res, 200, { payment_intent: intent })
}

export function handleConfirmPaymentIntent(store: MockStore, req: { headers: Record<string, string | string[] | undefined> }, res: ServerResponse, body: Record<string, unknown>): void {
  const clientSecret = req.headers['x-nexus-client-secret'] as string
  const intent = clientSecret ? store.intents.get(clientSecret) : undefined

  if (!intent) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent，请检查 client_secret。')
  }

  if (intent.status === 'succeeded') {
    return errorResponse(res, 409, 'api_error', 'payment_intent_already_confirmed', '该支付已成功，请勿重复提交。', { payment_intent: intent })
  }

  if (intent.status !== 'requires_payment_method' && intent.status !== 'requires_action') {
    return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', `当前状态 ${intent.status} 不允许确认支付。`, { payment_intent: intent })
  }

  const tokenKey = body.payment_method_token as string

  if (tokenKey?.startsWith('pm_saved_')) {
    const saved = SAVED_PAYMENT_METHODS.find((entry) => entry.id === tokenKey)
    if (!saved) {
      return errorResponse(res, 400, 'validation_error', 'invalid_token', '未找到对应的已保存支付方式。')
    }
    intent.payment_method = saved.id
    intent.status = 'succeeded'
    return json(res, 200, { payment_intent: intent })
  }

  const token = validateAndConsumeToken(store, tokenKey, res)
  if (!token) return

  const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
  if (decline) {
    intent.status = 'requires_payment_method'
    return json(res, 402, {
      error: {
        type: 'card_error',
        code: decline.code,
        decline_code: decline.decline_code,
        message: decline.message,
        payment_intent: intent,
      },
    })
  }

  intent.payment_method = token.payment_method_id

  if (token.card_number === THREE_DS_CARD) {
    intent.status = 'requires_action'
    return json(res, 200, {
      payment_intent: intent,
      next_action: {
        type: 'redirect',
        redirect_url: `/3ds-mock?intent=${intent.id}&return_url=${encodeURIComponent((body.return_url as string) ?? '/')}`,
      },
    })
  }

  intent.status = 'succeeded'
  return json(res, 200, { payment_intent: intent })
}

export function handleUpdatePaymentIntent(store: MockStore, res: ServerResponse, intentId: string, body: Record<string, unknown>): void {
  const intent = store.intents.get(intentId)
  if (!intent) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
  }

  const updatable = ['amount', 'currency', 'description', 'metadata', 'receipt_email', 'payment_method_types'] as const

  if (intent.status !== 'requires_payment_method' && (body.amount || body.currency || body.payment_method_types)) {
    return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', '当前状态不允许修改金额/币种/支付方式。')
  }

  for (const field of updatable) {
    if (body[field] !== undefined) {
      ;(intent as unknown as Record<string, unknown>)[field] = body[field]
    }
  }

  return json(res, 200, { payment_intent: intent })
}

export function handleCancelPaymentIntent(store: MockStore, res: ServerResponse, intentId: string): void {
  const intent = store.intents.get(intentId)
  if (!intent) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
  }
  if (intent.status === 'succeeded') {
    return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', '已成功的支付不能取消。')
  }
  intent.status = 'canceled'
  return json(res, 200, { payment_intent: intent })
}
