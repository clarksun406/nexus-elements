let apiBase = ''
let publishableKey = ''
let nexusAccount = ''
let cachedKey: { key_id: string; jwk: JsonWebKey } | null = null

export function configureApi(options: { apiBase?: string; publishableKey?: string; nexusAccount?: string }): void {
  apiBase = options.apiBase ?? ''
  publishableKey = options.publishableKey ?? ''
  nexusAccount = options.nexusAccount ?? ''
  cachedKey = null
}

export function apiUrl(path: string): string {
  return `${apiBase}${path}`
}

export function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (publishableKey) headers['X-Nexus-Key'] = publishableKey
  if (nexusAccount) headers['X-Nexus-Account'] = nexusAccount
  return headers
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function encryptionKey(): Promise<{ key_id: string; jwk: JsonWebKey } | null> {
  if (cachedKey) return cachedKey
  try {
    const response = await fetch(apiUrl('/v1/encryption_key'), { headers: apiHeaders() })
    if (!response.ok) return null
    const data = await response.json() as { key_id?: string; algorithm?: string; public_key_jwk?: JsonWebKey | null }
    if (data.algorithm !== 'RSA-OAEP' || !data.public_key_jwk || !data.key_id) return null
    cachedKey = { key_id: data.key_id, jwk: data.public_key_jwk }
    return cachedKey
  } catch {
    return null
  }
}

/**
 * Hybrid-encrypt `body.card` when the API publishes an RSA-OAEP key.
 * Falls back to the plaintext card object when the key is unavailable (TLS only).
 */
export async function protectTokenBody(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const card = body.card
  if (!card) return body
  const key = await encryptionKey()
  if (!key) return body
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(card))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, encoded))
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aes))
  const pub = await crypto.subtle.importKey('jwk', key.jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const ek = new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, rawAes))
  const next = { ...body }
  delete next.card
  next.encrypted_card = {
    key_id: key.key_id,
    alg: 'RSA-OAEP-256+A256GCM',
    ek: bytesToB64(ek),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipher),
  }
  return next
}

export async function requestToken(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const payload = await protectTokenBody(body)
  const response = await fetch(apiUrl('/v1/tokens'), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  return { ok: response.ok, data }
}
