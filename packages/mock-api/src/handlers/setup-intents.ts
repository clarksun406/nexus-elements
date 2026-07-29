import type { ServerResponse } from 'node:http'
import type { MockStore } from '../store.js'
import type { MockSetupIntent } from '../types.js'
import { DECLINE_CARDS } from '../constants.js'
import { json, errorResponse } from '../utils.js'
import { validateAndConsumeToken } from './payment-intents.js'

export function handleCreateSetupIntent(store: MockStore, res: ServerResponse, body: Record<string, unknown>): void {
  const setupIntent: MockSetupIntent = {
    id: `seti_test_${++store.setupCounter}`,
    object: 'setup_intent',
    status: 'requires_payment_method',
    client_secret: `seti_test_${store.setupCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
    usage: (body.usage as string) ?? 'off_session',
    created: Math.floor(Date.now() / 1000),
  }
  store.setupIntents.set(setupIntent.id, setupIntent)
  store.setupIntents.set(setupIntent.client_secret, setupIntent)
  return json(res, 200, { setup_intent: setupIntent })
}

export function handleConfirmSetupIntent(store: MockStore, req: { headers: Record<string, string | string[] | undefined> }, res: ServerResponse, body: Record<string, unknown>): void {
  const clientSecret = req.headers['x-nexus-client-secret'] as string
  const setupIntent = clientSecret ? store.setupIntents.get(clientSecret) : undefined

  if (!setupIntent) {
    return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 SetupIntent，请检查 client_secret。')
  }
  if (setupIntent.status === 'succeeded') {
    return errorResponse(res, 409, 'api_error', 'setup_intent_already_confirmed', '该 SetupIntent 已成功，请勿重复提交。')
  }

  const tokenKey = body.payment_method_token as string
  const token = validateAndConsumeToken(store, tokenKey, res)
  if (!token) return

  const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
  if (decline) {
    setupIntent.status = 'requires_payment_method'
    return json(res, 402, {
      error: {
        type: 'card_error',
        code: decline.code,
        decline_code: decline.decline_code,
        message: decline.message,
      },
    })
  }

  setupIntent.payment_method = token.payment_method_id
  setupIntent.status = 'succeeded'
  return json(res, 200, { setup_intent: setupIntent })
}
