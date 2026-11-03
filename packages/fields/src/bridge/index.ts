import { createMessage, verifyMessage, type SignedEnvelope } from '../../../core/src/iframe/channel'
import type { BridgeMessage, BridgeMessageType } from './types'

const REPLAY_TTL_MS = 2 * 60_000

type MessageHandler = (message: BridgeMessage) => void

interface BootstrapConfig {
  k: string
  g: string
  gk: string
  p: string
}

export class FieldBridge {
  private elementId = ''
  private signingKey = ''
  private parentOrigin = ''
  private groupId = ''
  private groupKey = ''
  private handlers = new Map<BridgeMessageType, Set<MessageHandler>>()
  private listener: ((event: MessageEvent) => void) | null = null
  private seen = new Map<string, number>()
  private recent = new Map<BridgeMessageType, BridgeMessage>()

  get id(): string {
    return this.elementId
  }

  getGroup(): { groupId: string; groupKey: string } | null {
    if (!this.groupId || !this.groupKey) return null
    return { groupId: this.groupId, groupKey: this.groupKey }
  }

  init(): void {
    const params = new URLSearchParams(window.location.search)
    this.elementId = params.get('elementId') ?? this.elementId
    const hash = window.location.hash.startsWith('#nexus=') ? window.location.hash.slice('#nexus='.length) : ''
    if (hash) {
      try {
        const parsed = JSON.parse(decodeURIComponent(hash)) as BootstrapConfig
        this.bootstrap({
          channelSecret: parsed.k,
          parentOrigin: parsed.p,
          groupId: parsed.g,
          groupKey: parsed.gk,
        })
        const next = `${window.location.pathname}${window.location.search}`
        window.history.replaceState(null, '', next)
      } catch {
        // Ignore a malformed bootstrap hash. The channel stays locked.
      }
    }
    this.listen()
  }

  /**
   * Install a channel secret once. Later calls cannot rotate it.
   * Used by the iframe hash bootstrap and by unit tests.
   */
  bootstrap(config: { elementId?: string; channelSecret: string; parentOrigin: string; groupId?: string; groupKey?: string }): void {
    if (config.elementId) this.elementId = config.elementId
    if (!this.signingKey) {
      this.signingKey = config.channelSecret
      this.parentOrigin = config.parentOrigin
      if (config.groupId) this.groupId = config.groupId
      if (config.groupKey) this.groupKey = config.groupKey
    }
    this.listen()
  }

  private listen(): void {
    if (this.listener) return
    this.listener = (event: MessageEvent) => {
      void this.dispatch(event)
    }
    window.addEventListener('message', this.listener)
  }

  private remember(id: string, timestamp: number): boolean {
    const cutoff = timestamp - REPLAY_TTL_MS
    for (const [seenId, seenAt] of this.seen) {
      if (seenAt < cutoff) this.seen.delete(seenId)
    }
    if (this.seen.has(id)) return false
    this.seen.set(id, timestamp)
    return true
  }

  private async dispatch(event: MessageEvent): Promise<void> {
    const message = event.data as BridgeMessage
    if (!message || message.version !== 1 || typeof message.type !== 'string' || !message.type.startsWith('nexus:')) return
    if (this.elementId && message.elementId !== this.elementId) return
    if (!this.signingKey || !this.parentOrigin) return
    if (event.source !== window.parent) return
    if (event.origin !== this.parentOrigin) return
    if (!(await verifyMessage(message as SignedEnvelope, this.signingKey))) return
    if (!this.remember(message.id, message.timestamp)) return

    this.recent.set(message.type, message)
    this.handlers.get(message.type)?.forEach((handler) => handler(message))
  }

  async send<T>(type: BridgeMessageType, payload: T): Promise<void> {
    if (!this.signingKey || !this.parentOrigin) return
    const cleanPayload = JSON.parse(JSON.stringify(payload)) as T
    const message = await createMessage(type, this.elementId, cleanPayload, this.signingKey, 'fld')
    window.parent.postMessage(message, this.parentOrigin)
  }

  on(type: BridgeMessageType, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    const queued = this.recent.get(type)
    if (queued && (type === 'nexus:init' || type === 'nexus:update' || type === 'nexus:appearance' || type === 'nexus:brand')) {
      handler(queued)
    }
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
    this.recent.clear()
    this.seen.clear()
  }

  /** Test helper. Does not rotate a secret that was already installed. */
  resetForTests(): void {
    this.destroy()
    this.elementId = ''
    this.signingKey = ''
    this.parentOrigin = ''
    this.groupId = ''
    this.groupKey = ''
  }
}

export const bridge = new FieldBridge()
