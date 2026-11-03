export type BridgeMessageType =
  | 'nexus:init'
  | 'nexus:mount'
  | 'nexus:unmount'
  | 'nexus:update'
  | 'nexus:appearance'
  | 'nexus:focus'
  | 'nexus:blur'
  | 'nexus:clear'
  | 'nexus:destroy'
  | 'nexus:tokenize'
  | 'nexus:collect-data'
  | 'nexus:collect-result'
  | 'nexus:confirm'
  | 'nexus:cancel'
  | 'nexus:complete'
  | 'nexus:ready'
  | 'nexus:change'
  | 'nexus:focus-event'
  | 'nexus:blur-event'
  | 'nexus:error'
  | 'nexus:escape'
  | 'nexus:click'
  | 'nexus:token-result'
  | 'nexus:brand'
  | 'nexus:resize'
  | 'nexus:collapse'
  | 'nexus:fetch-updates'

export interface BridgeMessage<T = unknown> {
  version: 1
  id: string
  type: BridgeMessageType
  elementId: string
  payload: T
  signature: string
  timestamp: number
}

export interface ResolvedAppearancePayload {
  variables: Record<string, string>
  rules: Record<string, Record<string, string>>
}

export interface InitPayload {
  publishableKey: string
  elementType: string
  options: Record<string, unknown>
  appearance: ResolvedAppearancePayload
  locale: string
  fonts?: Array<{ family: string; src: string; weight?: string; style?: string }>
  apiBase?: string
  nexusAccount?: string
}

export interface UpdatePayload {
  options: Record<string, unknown>
}

export interface GroupedCardData {
  number?: string
  exp_month?: number
  exp_year?: number
  cvc?: string
}

export interface TokenizePayload {
  clientSecret: string
  billingDetails?: Record<string, unknown>
  groupedCard?: GroupedCardData
}

export interface TokenResultPayload {
  token?: string
  paymentMethodId?: string
  error?: {
    type: string
    code?: string
    message: string
  }
}

export interface ChangePayload {
  complete: boolean
  empty: boolean
  valid: boolean
  elementType: string
  brand?: string
  paymentMethodType?: string
  error?: {
    type: string
    message: string
    code?: string
  }
  value?: Record<string, string>
}

export interface ReadyPayload {
  elementType: string
  availablePaymentMethods?: Record<string, boolean>
}

export interface ExpressConfirmPayload {
  walletType: string
}

export interface CompletePayload {
  status: 'success' | 'fail'
}
