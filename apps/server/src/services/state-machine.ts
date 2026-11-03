import type { PaymentIntentStatus } from '@nexus-elements/contracts'

const CONFIRMABLE: ReadonlySet<PaymentIntentStatus> = new Set(['requires_payment_method', 'requires_action'])

const TRANSITIONS: Record<PaymentIntentStatus, readonly PaymentIntentStatus[]> = {
  requires_payment_method: ['processing', 'requires_action', 'succeeded', 'canceled', 'requires_payment_method'],
  processing: ['succeeded', 'requires_action', 'requires_payment_method', 'canceled'],
  requires_action: ['processing', 'succeeded', 'requires_payment_method', 'canceled'],
  succeeded: [],
  canceled: [],
}

export function canConfirm(status: PaymentIntentStatus): boolean {
  return CONFIRMABLE.has(status)
}

export function canCancel(status: PaymentIntentStatus): boolean {
  return status !== 'succeeded'
}

export function canTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal payment intent transition ${from} -> ${to}`)
  }
}
