import { NexusElement } from './element'
import { IframeBridge } from './iframe/bridge'
import { resolveAppearance } from './theme'
import type { ElementsOptions, ElementType } from './types'

let elementCounter = 0

export interface ElementsRuntimeConfig {
  fieldsUrl?: string
  apiBase?: string
  nexusAccount?: string
}

export class NexusElements {
  private options: ElementsOptions
  private bridge: IframeBridge
  private elements = new Map<string, NexusElement>()
  private publishableKey: string
  private fieldsUrl?: string
  private apiBase: string
  private nexusAccount?: string

  constructor(publishableKey: string, options: ElementsOptions = {}, fieldsUrlOrConfig?: string | ElementsRuntimeConfig) {
    const config: ElementsRuntimeConfig = typeof fieldsUrlOrConfig === 'string' ? { fieldsUrl: fieldsUrlOrConfig } : (fieldsUrlOrConfig ?? {})
    this.publishableKey = publishableKey
    this.options = options
    this.fieldsUrl = config.fieldsUrl
    this.apiBase = config.apiBase ?? ''
    this.nexusAccount = config.nexusAccount
    this.bridge = new IframeBridge()
  }

  create(type: ElementType, options: Record<string, unknown> = {}): NexusElement {
    const id = `nexus_el_${++elementCounter}`
    const element = new NexusElement({
      id,
      type,
      options,
      bridge: this.bridge,
      publishableKey: this.publishableKey,
      appearance: this.options.appearance ?? null,
      locale: this.options.locale ?? 'en',
      fieldsUrl: this.fieldsUrl,
      fonts: this.options.fonts,
      apiBase: this.apiBase,
      nexusAccount: this.nexusAccount,
    })
    this.elements.set(id, element)
    element.setGroupProvider(() => [...this.elements.values()])
    return element
  }

  getElement(id: string): NexusElement | undefined {
    return this.elements.get(id)
  }

  update(options: Partial<ElementsOptions>): void {
    this.options = { ...this.options, ...options }
    const appearance = resolveAppearance(this.options.appearance ?? null)
    for (const element of this.elements.values()) {
      if (element.isMounted()) {
        void element.update({ __elementsOptions: this.options, __appearance: appearance })
      }
      element.setAppearance(this.options.appearance ?? null)
    }
  }

  async fetchUpdates(): Promise<void> {
    const tasks: Promise<void>[] = []
    for (const element of this.elements.values()) {
      if (element.type === 'cart' || element.type === 'order' || element.type === 'payment') {
        tasks.push(element.fetchUpdates())
      }
    }
    await Promise.all(tasks)
  }

  destroyAll(): void {
    for (const element of this.elements.values()) {
      element.destroy()
    }
    this.elements.clear()
  }

  getBridge(): IframeBridge {
    return this.bridge
  }

  getClientSecret(): string | undefined {
    return this.options.clientSecret
  }
}
