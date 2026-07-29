import { NexusElement } from './element'
import { IframeBridge } from './iframe/bridge'
import type { Appearance, ElementsOptions, ElementType } from './types'

let elementCounter = 0

export class NexusElements {
  private options: ElementsOptions
  private bridge: IframeBridge
  private elements = new Map<string, NexusElement>()
  private publishableKey: string
  private fieldsUrl?: string

  constructor(publishableKey: string, options: ElementsOptions = {}, fieldsUrl?: string) {
    this.publishableKey = publishableKey
    this.options = options
    this.fieldsUrl = fieldsUrl
    this.bridge = new IframeBridge(publishableKey)
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
    for (const element of this.elements.values()) {
      if (element.isMounted()) {
        element.update({ __elementsOptions: this.options })
      }
    }
    if (options.appearance !== undefined) {
      const appearance: Appearance | null = this.options.appearance ?? null
      for (const element of this.elements.values()) {
        element.setAppearance(appearance)
      }
    }
  }

  fetchUpdates(): Promise<void> {
    return Promise.resolve()
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
