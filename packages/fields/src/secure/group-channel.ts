export interface CardParts {
  number?: string
  exp_month?: number
  exp_year?: number
  cvc?: string
  postalCode?: string
}

interface WireMessage {
  role: string
  iv: string
  ciphertext: string
}

const peers = new Map<string, CardParts>()
let channel: BroadcastChannel | null = null
let aesKey: CryptoKey | null = null
let selfRole = ''
let keyReady: Promise<void> = Promise.resolve()

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function startGroupChannel(groupId: string, groupKeyHex: string): void {
  if (typeof BroadcastChannel === 'undefined' || !groupId || !groupKeyHex || groupKeyHex.length < 32) return
  channel?.close()
  peers.clear()
  const raw = new Uint8Array(groupKeyHex.length / 2)
  for (let i = 0; i < raw.length; i++) raw[i] = parseInt(groupKeyHex.slice(i * 2, i * 2 + 2), 16)
  const keyBytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  keyReady = crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']).then((key) => {
    aesKey = key
  })
  channel = new BroadcastChannel(`nexus-group:${groupId}`)
  channel.onmessage = (event: MessageEvent<WireMessage>) => {
    void decrypt(event.data)
  }
}

async function decrypt(message: WireMessage | undefined): Promise<void> {
  if (!message || !aesKey || message.role === selfRole) return
  try {
    const iv = b64ToBytes(message.iv)
    const cipher = b64ToBytes(message.ciphertext)
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer }, aesKey, cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength) as ArrayBuffer)
    const parts = JSON.parse(new TextDecoder().decode(clear)) as CardParts
    peers.set(message.role, parts)
  } catch {
    // Ignore frames we cannot decrypt. They are not part of this group.
  }
}

export async function publishCardParts(role: string, parts: CardParts): Promise<void> {
  selfRole = role
  await keyReady
  if (!channel || !aesKey) return
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(parts))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer.slice(0) as ArrayBuffer }, aesKey, encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer))
  const wire: WireMessage = { role, iv: bytesToB64(iv), ciphertext: bytesToB64(cipher) }
  channel.postMessage(wire)
}

const PEERS: Record<string, string[]> = {
  cardNumber: ['cardExpiry', 'cardCvc'],
  cardExpiry: ['cardNumber', 'cardCvc'],
  cardCvc: ['cardNumber', 'cardExpiry'],
}

export async function collectCardParts(role: string, local: CardParts, waitMs = 500): Promise<CardParts> {
  await publishCardParts(role, local)
  const needed = PEERS[role] ?? []
  const start = Date.now()
  while (channel && needed.some((peer) => !peers.has(peer)) && Date.now() - start < waitMs) {
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  const merged: CardParts = { ...local }
  for (const [peerRole, parts] of peers) {
    if (peerRole === role) continue
    Object.assign(merged, stripEmpty(parts))
  }
  return merged
}

function stripEmpty(parts: CardParts): CardParts {
  const output: CardParts = {}
  if (parts.number) output.number = parts.number
  if (parts.exp_month) output.exp_month = parts.exp_month
  if (parts.exp_year) output.exp_year = parts.exp_year
  if (parts.cvc) output.cvc = parts.cvc
  if (parts.postalCode) output.postalCode = parts.postalCode
  return output
}

export function resetGroupChannelForTests(): void {
  channel?.close()
  channel = null
  aesKey = null
  peers.clear()
  selfRole = ''
  keyReady = Promise.resolve()
}
