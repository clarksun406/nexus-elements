import type { IframeBridge } from './iframe/bridge'
import { createElementIframe, destroyIframe } from './iframe/manager'
import { resolveAppearance } from './theme'
import type { Appearance, ChangeEvent, ElementEventType, ReadyEvent } from './types'
import type { BridgeMessage, ChangePayload, GroupedCardData, ReadyPayload } from './types/bridge'

type EventHandler = (event: unknown) => void

const CARD_PART_TYPES = ['cardNumber', 'cardExpiry', 'cardCvc']

export class NexusElement {
  readonly id: string
  readonly type: string

  private bridge: IframeBridge
  private iframe: HTMLIFrameElement | null = null
  private listeners = new Map<string, Set<EventHandler>>()
  private options: Record<string, unknown>
  private publishableKey: string
  private appearance: Appearance | null
  private locale: string
  private fieldsUrl?: string
  private mounted = false
  private destroyed = false
  private groupProvider: (() => NexusElement[]) | null = null
  private lastPropagatedBrand: string | null = null
  private fonts?: Array<{ family: string; src: string; weight?: string; style?: string }>

  constructor(params: {
    id: string
    type: string
    options: Record<string, unknown>
    bridge: IframeBridge
    publishableKey: string
    appearance: Appearance | null
    locale: string
    fieldsUrl?: string
    fonts?: Array<{ family: string; src: string; weight?: string; style?: string }>
  }) {
    this.id = params.id
    this.type = params.type
    this.options = params.options
    this.bridge = params.bridge
    this.publishableKey = params.publishableKey
    this.appearance = params.appearance
    this.locale = params.locale
    this.fieldsUrl = params.fieldsUrl
    this.fonts = params.fonts

    this.bridge.on('nexus:ready', this.id, (msg: BridgeMessage) => {
      const payload = msg.payload as ReadyPayload
      this.emit('ready', {
        elementType: payload.elementType as ChangeEvent['elementType'],
        availablePaymentMethods: payload.availablePaymentMethods,
      } satisfies ReadyEvent)
    })

    this.bridge.on('nexus:change', this.id, (msg: BridgeMessage) => {
      const payload = msg.payload as ChangePayload
      if (this.type === 'cardNumber' && payload.brand && payload.brand !== this.lastPropagatedBrand) {
        this.lastPropagatedBrand = payload.brand
        for (const sibling of this.groupProvider?.() ?? []) {
          if (sibling.id !== this.id && sibling.type === 'cardCvc' && sibling.isMounted()) {
            void this.bridge.send('nexus:brand', sibling.id, { brand: payload.brand })
          }
        }
      }
      this.emit('change', payload as unknown as ChangeEvent)
    })

    this.bridge.on('nexus:focus-event', this.id, () => this.emit('focus', {}))
    this.bridge.on('nexus:blur-event', this.id, () => this.emit('blur', {}))
    this.bridge.on('nexus:resize', this.id, (msg: BridgeMessage) => {
      const payload = msg.payload as { height?: number }
      if (this.iframe && typeof payload.height === 'number' && payload.height > 0) {
        this.iframe.style.height = `${Math.ceil(payload.height)}px`
      }
    })
    this.bridge.on('nexus:escape', this.id, () => this.emit('escape', {}))
    this.bridge.on('nexus:click', this.id, (msg: BridgeMessage) => this.emit('click', msg.payload))
    this.bridge.on('nexus:error', this.id, (msg: BridgeMessage) => this.emit('error', msg.payload))
    this.bridge.on('nexus:confirm', this.id, (msg: BridgeMessage) => {
      const payload = msg.payload as { walletType: string }
      this.emit('confirm', {
        walletType: payload.walletType,
        complete: (status: 'success' | 'fail') => {
          void this.bridge.send('nexus:complete', this.id, { status })
        },
      })
    })
    this.bridge.on('nexus:cancel', this.id, () => this.emit('cancel', {}))
  }

  mount(target: string | HTMLElement): this {
    if (this.destroyed) throw new Error('Cannot mount a destroyed element.')
    if (this.mounted) throw new Error('Element is already mounted. Call unmount() first.')

    const container = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    if (!container) throw new Error(`Mount target not found: ${target}`)

    this.iframe = createElementIframe(
      { elementId: this.id, elementType: this.type, fieldsUrl: this.fieldsUrl },
      this.bridge,
      {
        publishableKey: this.publishableKey,
        elementType: this.type,
        options: this.options,
        appearance: resolveAppearance(this.appearance),
        locale: this.locale,
        fonts: this.fonts,
      },
    )
    container.appendChild(this.iframe)
    this.bridge.attach(this.id, this.iframe)
    this.mounted = true
    return this
  }

  unmount(): void {
    if (!this.mounted) return
    void this.bridge.send('nexus:unmount', this.id, {})
    this.bridge.detach(this.id)
    destroyIframe(this.iframe)
    this.iframe = null
    this.mounted = false
  }

  destroy(): void {
    if (this.destroyed) return
    this.unmount()
    void this.bridge.send('nexus:destroy', this.id, {})
    this.listeners.clear()
    this.destroyed = true
  }

  update(options: Record<string, unknown>): Promise<void> {
    this.options = { ...this.options, ...options }
    if (!this.mounted) return Promise.resolve()
    return this.bridge
      .sendAndWait('nexus:update', this.id, { options: this.options }, 'nexus:ready')
      .then(() => undefined)
  }

  setAppearance(appearance: Appearance | null): void {
    this.appearance = appearance
    if (this.mounted) {
      void this.bridge.send('nexus:appearance', this.id, resolveAppearance(appearance))
    }
  }

  focus(): void {
    void this.bridge.send('nexus:focus', this.id, {})
  }

  blur(): void {
    void this.bridge.send('nexus:blur', this.id, {})
  }

  clear(): void {
    void this.bridge.send('nexus:clear', this.id, {})
  }

  on(event: ElementEventType, handler: EventHandler): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return this
  }

  off(event: ElementEventType, handler?: EventHandler): this {
    if (!handler) {
      this.listeners.delete(event)
    } else {
      this.listeners.get(event)?.delete(handler)
    }
    return this
  }

  setGroupProvider(provider: () => NexusElement[]): void {
    this.groupProvider = provider
  }

  async tokenize(clientSecret: string, billingDetails?: Record<string, unknown>): Promise<{ token?: string; paymentMethodId?: string; error?: { type: string; code?: string; message: string } }> {
    const groupedCard = await this.collectGroupedCardData()
    return this.bridge.sendAndWait('nexus:tokenize', this.id, { clientSecret, billingDetails, groupedCard }, 'nexus:token-result')
  }

  private async collectGroupedCardData(): Promise<GroupedCardData | undefined> {
    if (!CARD_PART_TYPES.includes(this.type)) return undefined
    const siblings = (this.groupProvider?.() ?? []).filter(
      (sibling) => sibling.id !== this.id && CARD_PART_TYPES.includes(sibling.type),
    )
    if (siblings.length === 0) return undefined

    const parts = await Promise.all(
      siblings.map((sibling) =>
        this.bridge
          .sendAndWait<Record<string, never>, GroupedCardData>('nexus:collect-data', sibling.id, {}, 'nexus:collect-result', 3000)
          .catch(() => ({} as GroupedCardData)),
      ),
    )
    return Object.assign({}, ...parts) as GroupedCardData
  }

  isMounted(): boolean {
    return this.mounted
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload))
  }
}
