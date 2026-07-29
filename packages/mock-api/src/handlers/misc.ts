import type { MockStore } from '../store.js'
import { SAVED_PAYMENT_METHODS } from '../constants.js'
import { json } from '../utils.js'
import type { ServerResponse } from 'node:http'

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
  json(res, 200, {
    key_id: 'ek_test_disabled',
    algorithm: 'none',
    public_key_pem: null,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    note: 'Phase 1: TLS-only encryption. Application-layer encryption will be enabled in a future phase.',
  })
}
