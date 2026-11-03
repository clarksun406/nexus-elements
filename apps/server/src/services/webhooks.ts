import { clientSecretFor, resourceId } from '@nexus-elements/contracts'
import { signWebhook } from '../crypto/webhook.js'
import type { ServiceDeps } from './deps.js'

export async function emitEvent(deps: ServiceDeps, merchantId: string, type: string, object: Record<string, unknown>): Promise<void> {
  const n = await deps.repo.nextSequence('evt')
  const created = Math.floor(deps.clock.now() / 1000)
  const id = resourceId('evt', deps.config.mode, n)
  const event = {
    id,
    object: 'event',
    type,
    created,
    data: { object },
  }
  const payload = JSON.stringify(event)
  const header = signWebhook(deps.config.webhookSecret, payload, created)
  await deps.repo.insertWebhookEvent({
    id,
    merchantId,
    type,
    payload: { ...event, signature: header },
    created,
  })
  if (!deps.config.webhookUrl) return
  try {
    await fetch(deps.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nexus-Signature': header,
      },
      body: payload,
      signal: AbortSignal.timeout(2_000),
    })
  } catch {
    // Delivery is best-effort. The event row is the source of truth for retries.
  }
}

export function newClientSecret(id: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let secret = ''
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const byte of bytes) secret += alphabet[byte % alphabet.length]
  return clientSecretFor(id, secret)
}
