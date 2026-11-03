export const SIGNING_KEY_PREFIX = 'nexus_channel_'
export const MAX_CLOCK_SKEW_MS = 60_000

export interface SignedEnvelope<T = unknown> {
  version: 1
  id: string
  type: string
  elementId: string
  payload: T
  signature: string
  timestamp: number
}

const hmacKeyCache = new Map<string, CryptoKey>()

async function getHmacKey(signingKey: string): Promise<CryptoKey> {
  const cached = hmacKeyCache.get(signingKey)
  if (cached) return cached
  const keyMaterial = new TextEncoder().encode(`${SIGNING_KEY_PREFIX}${signingKey}`)
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  hmacKeyCache.set(signingKey, key)
  return key
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSecret(bytes = 32): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return bufferToHex(buffer.buffer)
}

/** Compare two strings without short-circuiting on the first mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export function canonicalBody(message: Pick<SignedEnvelope, 'id' | 'type' | 'elementId' | 'payload' | 'timestamp'>): string {
  return JSON.stringify({
    id: message.id,
    type: message.type,
    elementId: message.elementId,
    payload: message.payload,
    timestamp: message.timestamp,
  })
}

export async function signMessage(payload: string, key: string): Promise<string> {
  const hmacKey = await getHmacKey(key)
  const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payload))
  return `sig_${bufferToHex(signature)}`
}

export async function verifyMessage(message: SignedEnvelope, key: string, now = Date.now()): Promise<boolean> {
  if (!message || message.version !== 1 || typeof message.signature !== 'string' || typeof message.timestamp !== 'number') {
    return false
  }
  if (!Number.isFinite(message.timestamp) || Math.abs(now - message.timestamp) > MAX_CLOCK_SKEW_MS) {
    return false
  }
  const expected = await signMessage(canonicalBody(message), key)
  return timingSafeEqual(message.signature, expected)
}

let messageCounter = 0

export function generateMessageId(prefix = 'msg'): string {
  messageCounter += 1
  return `${prefix}_${messageCounter}_${Math.random().toString(36).slice(2, 10)}`
}

export async function createMessage<T>(
  type: string,
  elementId: string,
  payload: T,
  key: string,
  idPrefix = 'msg',
): Promise<SignedEnvelope<T>> {
  const id = generateMessageId(idPrefix)
  const timestamp = Date.now()
  const body = canonicalBody({ id, type, elementId, payload, timestamp })
  return {
    version: 1,
    id,
    type,
    elementId,
    payload,
    signature: await signMessage(body, key),
    timestamp,
  }
}

const SENSITIVE_KEYS = new Set([
  'number',
  'pan',
  'cvc',
  'cvv',
  'cardNumber',
  'card_number',
  'accountNumber',
  'account_number',
  'iban',
])

/** Drop raw payment secrets if a frame ever includes them in a parent-bound payload. */
export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry)) as T
  }
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) continue
    output[key] = redactSensitive(entry)
  }
  return output as T
}
