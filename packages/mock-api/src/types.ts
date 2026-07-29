import type { IncomingMessage, ServerResponse } from 'node:http'

export interface MockPaymentIntent {
  id: string
  object: 'payment_intent'
  amount: number
  currency: string
  status: string
  client_secret: string
  description?: string
  metadata?: Record<string, string>
  payment_method_types: string[]
  payment_method?: string
  created: number
}

export interface MockToken {
  token: string
  payment_method_id: string
  type: string
  card_number?: string
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
  redirect_method?: Record<string, unknown>
  billing_details?: Record<string, unknown>
  used: boolean
  expires_at: number
}

export interface MockSetupIntent {
  id: string
  object: 'setup_intent'
  status: string
  client_secret: string
  usage: string
  payment_method?: string
  created: number
}

export interface MockCheckoutSession {
  id: string
  object: 'checkout.session'
  status: string
  mode: string
  ui_mode: string
  amount: number
  currency: string
  line_items: Array<{ name: string; amount: number; quantity: number }>
  success_url?: string
  cancel_url?: string
  client_secret: string
  url: string
  payment_intent?: string
  created: number
}

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: Record<string, unknown>,
) => void | Promise<void>
