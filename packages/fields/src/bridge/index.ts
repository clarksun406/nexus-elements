import type { BridgeMessage, BridgeMessageType } from './types'

const SIGNING_KEY_PREFIX = 'nexus_bridge_'

let messageCounter = 0

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

async function signMessage(payload: string, key: string): Promise<string> {
  const hmacKey = await getHmacKey(key)
  const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payload))
  return `sig_${bufferToHex(signature)}`
}

async function verifyMessage(message: BridgeMessage, key: string): Promise<boolean> {
  const payload = JSON.stringify({ id: message.id, type: message.type, elementId: message.elementId, payload: message.payload })
  return message.signature === (await signMessage(payload, key))
}

type MessageHandler = (message: BridgeMessage) => void

export class FieldBridge {
  private elementId = ''
  private signingKey = ''
  private handlers = new Map<BridgeMessageType, Set<MessageHandler>>()
  private listener: ((event: MessageEvent) => void) | null = null

  get id(): string {
    return this.elementId
  }

  init(): void {
    const params = new URLSearchParams(window.location.search)
    this.elementId = params.get('elementId') ?? ''

    this.listener = (event: MessageEvent) => {
      const message = event.data as BridgeMessage
      if (!message || message.version !== 1 || !message.type?.startsWith('nexus:')) return
      if (message.elementId !== this.elementId) return
      void this.dispatch(message)
    }
    window.addEventListener('message', this.listener)
  }

  private async dispatch(message: BridgeMessage): Promise<void> {
    if (message.type === 'nexus:init') {
      const payload = message.payload as { publishableKey: string }
      this.signingKey = payload.publishableKey
      if (!(await verifyMessage(message, this.signingKey))) return
    } else if (this.signingKey && !(await verifyMessage(message, this.signingKey))) {
      return
    }

    this.handlers.get(message.type)?.forEach((handler) => handler(message))
  }

  async send<T>(type: BridgeMessageType, payload: T): Promise<void> {
    const cleanPayload = JSON.parse(JSON.stringify(payload)) as T
    const id = `fld_${++messageCounter}_${Math.random().toString(36).slice(2, 10)}`
    const body = JSON.stringify({ id, type, elementId: this.elementId, payload: cleanPayload })
    const message: BridgeMessage<T> = {
      version: 1,
      id,
      type,
      elementId: this.elementId,
      payload: cleanPayload,
      signature: await signMessage(body, this.signingKey),
      timestamp: Date.now(),
    }
    window.parent.postMessage(message, '*')
  }

  on(type: BridgeMessageType, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: BridgeMessageType, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  destroy(): void {
    if (this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
    }
    this.handlers.clear()
  }
}

export const bridge = new FieldBridge()
