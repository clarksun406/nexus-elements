import { inject } from 'vue'
import type { Nexus, NexusElements, NexusElement, ElementType } from '@nexus-elements/core'
import { NexusKey } from './context'
import type { NexusContext } from './context'

export function useNexus(): NexusContext {
  const context = inject(NexusKey)
  if (!context) {
    throw new Error('useNexus() must be used within a <NexusElements> provider component.')
  }
  return context
}

export function useElements(): NexusElements {
  return useNexus().elements
}

export function useElement(type: ElementType, options: Record<string, unknown> = {}): NexusElement {
  const { elements } = useNexus()
  return elements.create(type, options)
}

export function useNexusInstance(): Nexus {
  return useNexus().nexus
}
