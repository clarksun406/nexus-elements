import type { CardOutcome } from '@nexus-elements/contracts'

/**
 * Channel adapter. The sandbox adapter is deterministic. A nexus-pay (cards)
 * or nexus-recur (subscriptions) adapter can implement the same interface
 * later without changing route or intent code. Adapters receive a classified
 * outcome, never a raw PAN.
 */
export interface AuthorizeRequest {
  amount: number
  currency: string
  paymentMethodType: string
  outcome: CardOutcome
  merchantId: string
  intentId: string
  returnUrl?: string
}

export interface AuthorizeResponse {
  status: 'succeeded' | 'requires_action' | 'declined'
  decline?: { code: string; decline_code: string; message: string }
  redirectUrl?: string
}

export interface PaymentChannel {
  readonly name: string
  authorize(input: AuthorizeRequest): Promise<AuthorizeResponse>
}
