import type { InjectionKey, Ref } from 'vue'
import type { Nexus, NexusElements } from '@nexus-elements/core'

export interface NexusContext {
  nexus: Nexus
  elements: NexusElements
  ready: Ref<boolean>
}

export const NexusKey: InjectionKey<NexusContext> = Symbol('nexus-elements')
