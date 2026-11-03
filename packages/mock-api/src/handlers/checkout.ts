import type { ServerResponse } from 'node:http'
import type { MockStore } from '../store.js'
import type { MockPaymentIntent, MockCheckoutSession } from '../types.js'
import { validateAmount } from '@nexus-elements/contracts'
import { DECLINE_CARDS } from '../constants.js'
import { json, errorResponse } from '../utils.js'
import { validateAndConsumeToken } from './payment-intents.js'

export function handleCreateCheckoutSession(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
  const amountResult = validateAmount(body.amount)
  if (!amountResult.ok) {
    return errorResponse(res, amountResult.error.status, amountResult.error.type, amountResult.error.code, amountResult.error.message)
  }
  const amount = amountResult.amount

  const id = `cs_test_${++store.checkoutCounter}`
  const clientSecret = `${id}_secret_${Math.random().toString(36).slice(2, 10)}`
  const session: MockCheckoutSession = {
    id,
    object: 'checkout.session',
    status: 'open',
    mode: (body.mode as string) ?? 'payment',
    ui_mode: (body.ui_mode as string) ?? 'embedded',
    amount,
    currency: (body.currency as string) ?? 'cny',
    line_items: (body.line_items as MockCheckoutSession['line_items']) ?? [],
    success_url: body.success_url as string | undefined,
    cancel_url: body.cancel_url as string | undefined,
    client_secret: clientSecret,
    url: `/__nexus-checkout/index.html?clientSecret=${encodeURIComponent(clientSecret)}`,
    created: Math.floor(Date.now() / 1000),
  }
  store.checkoutSessions.set(session.id, session)
  store.checkoutSessions.set(session.client_secret, session)
  return json(res, 200, { checkout_session: session })
}

export function handleGetCheckoutSession(store: MockStore, req: { headers: Record<string, string | string[] | undefined> }, res: ServerResponse, sessionId: string): void {
  const session = store.checkoutSessions.get(sessionId)
  if (!session) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 Checkout Session。')
  }
  const providedSecret = req.headers['x-nexus-client-secret'] as string | undefined
  if (providedSecret !== session.client_secret) {
    return errorResponse(res, 401, 'api_error', 'invalid_client_secret', 'client_secret 无效。')
  }
  return json(res, 200, { checkout_session: session })
}

export function handleConfirmCheckoutSession(store: MockStore, req: { headers: Record<string, string | string[] | undefined> }, res: ServerResponse, sessionId: string, body: Record<string, unknown>): void {
  const session = store.checkoutSessions.get(sessionId)
  if (!session) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 Checkout Session。')
  }
  if (session.status !== 'open') {
    return errorResponse(res, 409, 'api_error', 'session_not_open', `当前状态 ${session.status} 不允许支付。`)
  }
  const providedSecret = req.headers['x-nexus-client-secret'] as string | undefined
  if (providedSecret !== session.client_secret) {
    return errorResponse(res, 401, 'api_error', 'invalid_client_secret', 'client_secret 无效。')
  }

  const tokenKey = body.payment_method_token as string
  const token = validateAndConsumeToken(store, tokenKey, res)
  if (!token) return

  const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
  if (decline) {
    return json(res, 402, {
      error: { type: 'card_error', code: decline.code, decline_code: decline.decline_code, message: decline.message },
    })
  }

  const intent: MockPaymentIntent = {
    id: `pi_test_${++store.intentCounter}`,
    object: 'payment_intent',
    amount: session.amount,
    currency: session.currency,
    status: 'succeeded',
    client_secret: `pi_test_${store.intentCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
    payment_method_types: ['card'],
    payment_method: token.payment_method_id,
    created: Math.floor(Date.now() / 1000),
  }
  store.intents.set(intent.id, intent)
  session.status = 'complete'
  session.payment_intent = intent.id
  return json(res, 200, { checkout_session: session })
}
