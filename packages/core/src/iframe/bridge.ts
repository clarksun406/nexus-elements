import type { BridgeMessage, BridgeMessageType } from '../types/bridge'

const SIGNING_KEY_PREFIX = 'nexus_bridge_'

let messageCounter = 0

export function generateMessageId(): string {
  return `msg_${++messageCounter}_${Math.random().toString(36).slice(2, 10)}`
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

export async function signMessage(payload: string, key: string): Promise<string> {
  const hmacKey = await getHmacKey(key)
  const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payload))
  return `sig_${bufferToHex(signature)}`
}

export async function verifyMessage(message: BridgeMessage, key: string): Promise<boolean> {
  const payload = JSON.stringify({ id: message.id, type: message.type, elementId: message.elementId, payload: message.payload })
  return message.signature === (await signMessage(payload, key))
}

export async function createMessage<T>(
  type: BridgeMessageType,
  elementId: string,
  payload: T,
  key: string,
): Promise<BridgeMessage<T>> {
  const id = generateMessageId()
  const body = JSON.stringify({ id, type, elementId, payload })
  return {
    version: 1,
    id,
    type,
    elementId,
    payload,
    signature: await signMessage(body, key),
    timestamp: Date.now(),
  }
}

type MessageHandler = (message: BridgeMessage) => void

export class IframeBridge {
  private iframes = new Map<string, HTMLIFrameElement>()
  private handlers = new Map<string, Set<MessageHandler>>()
  private globalHandlers = new Set<MessageHandler>()
  private targetOrigin = '*'
  private signingKey: string
  private listener: ((event: MessageEvent) => void) | null = null

  constructor(signingKey: string) {
    this.signingKey = signingKey
  }

  attach(elementId: string, iframe: HTMLIFrameElement, fieldsOrigin?: string): void {
    this.iframes.set(elementId, iframe)
    if (fieldsOrigin) {
      this.targetOrigin = fieldsOrigin
    }
    if (!this.listener) {
      this.listener = (event: MessageEvent) => this.handleIncoming(event)
      window.addEventListener('message', this.listener)
    }
  }

  detach(elementId: string): void {
    this.iframes.delete(elementId)
    for (const key of this.handlers.keys()) {
      if (key.endsWith(`:${elementId}`)) {
        this.handlers.delete(key)
      }
    }
    if (this.iframes.size === 0 && this.listener) {
      window.removeEventListener('message', this.listener)
      this.listener = null
      this.handlers.clear()
      this.globalHandlers.clear()
    }
  }

  async send<T>(type: BridgeMessageType, elementId: string, payload: T): Promise<void> {
    const cleanPayload = JSON.parse(JSON.stringify(payload)) as T
    const message = await createMessage(type, elementId, cleanPayload, this.signingKey)
    this.iframes.get(elementId)?.contentWindow?.postMessage(message, this.targetOrigin)
  }

  sendAndWait<TReq, TRes>(
    type: BridgeMessageType,
    elementId: string,
    payload: TReq,
    responseType: BridgeMessageType,
    timeout = 10000,
  ): Promise<TRes> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(responseType, elementId, handler)
        reject(new Error(`Bridge response timeout: ${responseType}`))
      }, timeout)

      const handler = (message: BridgeMessage) => {
        clearTimeout(timer)
        this.off(responseType, elementId, handler)
        resolve(message.payload as TRes)
      }

      this.on(responseType, elementId, handler)
      this.send(type, elementId, payload).catch((error) => {
        clearTimeout(timer)
        this.off(responseType, elementId, handler)
        reject(error)
      })
    })
  }

  on(type: string, elementId: string, handler: MessageHandler): void {
    const key = `${type}:${elementId}`
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set())
    }
    this.handlers.get(key)!.add(handler)
  }

  off(type: string, elementId: string, handler: MessageHandler): void {
    this.handlers.get(`${type}:${elementId}`)?.delete(handler)
  }

  onAny(handler: MessageHandler): void {
    this.globalHandlers.add(handler)
  }

  private handleIncoming(event: MessageEvent): void {
    const message = event.data as BridgeMessage
    if (!message || message.version !== 1 || !message.type?.startsWith('nexus:')) return

    void verifyMessage(message, this.signingKey).then((valid) => {
      if (!valid) return
      const key = `${message.type}:${message.elementId}`
      this.handlers.get(key)?.forEach((handler) => handler(message))
      this.globalHandlers.forEach((handler) => handler(message))
    })
  }
}
