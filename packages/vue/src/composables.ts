import { inject } from 'vue'
import type { Nexus, NexusElements, NexusElement, ElementType, ConfirmPaymentParams, ConfirmSetupParams, ConfirmCardPaymentParams, ConfirmResult } from '@nexus-elements/core'
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

export function useConfirm() {
  const nexus = useNexusInstance()
  const elements = useElements()
  return {
    confirmPayment(params: Omit<ConfirmPaymentParams, 'elements'> = {}): Promise<ConfirmResult<'payment'>> {
      return nexus.confirmPayment({ ...params, elements })
    },
    confirmSetup(params: Omit<ConfirmSetupParams, 'elements'> & { confirmParams: ConfirmSetupParams['confirmParams'] }): Promise<ConfirmResult<'setup'>> {
      return nexus.confirmSetup({ ...params, elements })
    },
    confirmCardPayment(clientSecret: string, params: ConfirmCardPaymentParams): Promise<ConfirmResult<'payment'>> {
      return nexus.confirmCardPayment(clientSecret, params)
    },
  }
}
