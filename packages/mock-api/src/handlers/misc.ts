import type { MockStore } from '../store.js'
import { SAVED_PAYMENT_METHODS } from '../constants.js'
import { json } from '../utils.js'
import type { ServerResponse } from 'node:http'
import { getEncryptionKey } from '../crypto.js'

export function handleComplete3ds(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
  const intent = store.intents.get(body.intent as string)
  if (intent && intent.status === 'requires_action') {
    intent.status = body.status === 'approved' ? 'succeeded' : 'requires_payment_method'
  }
  json(res, 200, { ok: true })
}

export function handleGetPaymentMethods(res: ServerResponse): void {
  json(res, 200, { data: SAVED_PAYMENT_METHODS })
}

export function handleGetEncryptionKey(res: ServerResponse): void {
  json(res, 200, getEncryptionKey())
}

const orders = new Map<string, Record<string, unknown>>()

export function handleGetOrder(res: ServerResponse, orderId: string): void {
  const order = orders.get(orderId)
  if (!order) {
    json(res, 404, { error: { type: 'api_error', code: 'resource_missing', message: '未找到订单。' } })
    return
  }
  json(res, 200, { order })
}

export function handleUpsertOrder(res: ServerResponse, orderId: string, body: Record<string, unknown>): void {
  const order = { id: orderId, status: body.status ?? 'pending', ...body }
  orders.set(orderId, order)
  json(res, 200, { order })
}

export function handleApplePaySession(res: ServerResponse): void {
  json(res, 501, {
    error: {
      type: 'api_error',
      code: 'apple_pay_unavailable',
      message: 'Apple Pay merchant validation is not configured. The wallet button falls back to the demo flow.',
    },
  })
}
