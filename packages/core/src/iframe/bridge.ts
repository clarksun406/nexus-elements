import {
  createMessage,
  randomSecret,
  redactSensitive,
  verifyMessage,
  type SignedEnvelope,
} from './channel'
import type { BridgeMessage, BridgeMessageType } from '../types/bridge'

export { createMessage, signMessage, verifyMessage, timingSafeEqual, canonicalBody } from './channel'

const REPLAY_TTL_MS = 2 * 60_000
const REPLAY_MAX = 500

type MessageHandler = (message: BridgeMessage) => void

export interface ChannelBootstrap {
  secret: string
  groupId: string
  groupKey: string
}

export class IframeBridge {
  private iframes = new Map<string, HTMLIFrameElement>()
  private origins = new Map<string, string>()
  private handlers = new Map<string, Set<MessageHandler>>()
  private globalHandlers = new Set<MessageHandler>()
  private seen = new Map<string, number>()
  private listener: ((event: MessageEvent) => void) | null = null
  private readonly bootstrap: ChannelBootstrap

  constructor(_ignoredPublishableKey?: string, bootstrap?: ChannelBootstrap) {
    this.bootstrap = bootstrap ?? {
      secret: randomSecret(),
      groupId: `grp_${randomSecret(8)}`,
      groupKey: randomSecret(),
    }
  }

  /** Random channel secret. Never the publishable key, and never rotated by nexus:init. */
  getBootstrap(): ChannelBootstrap {
    return this.bootstrap
  }

  attach(elementId: string, iframe: HTMLIFrameElement, fieldsOrigin: string): void {
    this.iframes.set(elementId, iframe)
    this.origins.set(elementId, fieldsOrigin)
    if (!this.listener) {
      this.listener = (event: MessageEvent) => {
        void this.handleIncoming(event)
      }
      window.addEventListener('message', this.listener)
    }
  }

  detach(elementId: string): void {
    this.iframes.delete(elementId)
    this.origins.delete(elementId)
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
    const message = await createMessage(type, elementId, cleanPayload, this.bootstrap.secret)
    const iframe = this.iframes.get(elementId)
    const origin = this.origins.get(elementId)
    if (!iframe?.contentWindow || !origin) return
    iframe.contentWindow.postMessage(message, origin)
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

  private remember(id: string, timestamp: number): boolean {
    const cutoff = timestamp - REPLAY_TTL_MS
    if (this.seen.size > REPLAY_MAX) {
      for (const [seenId, seenAt] of this.seen) {
        if (seenAt < cutoff) this.seen.delete(seenId)
      }
    }
    if (this.seen.has(id)) return false
    this.seen.set(id, timestamp)
    return true
  }

  private async handleIncoming(event: MessageEvent): Promise<void> {
    const message = event.data as BridgeMessage
    if (!message || message.version !== 1 || typeof message.type !== 'string' || !message.type.startsWith('nexus:')) return

    const iframe = this.iframes.get(message.elementId)
    const origin = this.origins.get(message.elementId)
    if (!iframe || !origin) return
    if (event.origin !== origin) return
    if (event.source !== iframe.contentWindow) return

    const valid = await verifyMessage(message as SignedEnvelope, this.bootstrap.secret)
    if (!valid) return
    if (!this.remember(message.id, message.timestamp)) return

    const safe = { ...message, payload: redactSensitive(message.payload) }
    const key = `${message.type}:${message.elementId}`
    this.handlers.get(key)?.forEach((handler) => handler(safe))
    this.globalHandlers.forEach((handler) => handler(safe))
  }
}
