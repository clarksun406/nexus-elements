import type { ServerConfig } from '../config.js'
import type { EncryptionKeys } from '../crypto/keys.js'
import type { Repository } from '../db/types.js'
import type { PaymentChannel } from '../gateway/types.js'
import type { AuthenticatedMerchant } from '../auth/keys.js'

export interface Clock {
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }

export interface ServiceDeps {
  repo: Repository
  gateway: PaymentChannel
  clock: Clock
  keys: EncryptionKeys
  config: ServerConfig
}

export type MerchantContext = AuthenticatedMerchant

export async function seedSavedMethods(deps: ServiceDeps): Promise<void> {
  const { SAVED_PAYMENT_METHODS } = await import('@nexus-elements/contracts')
  const existing = await deps.repo.listPaymentMethods(deps.config.accountId)
  if (existing.length > 0) return
  for (const method of SAVED_PAYMENT_METHODS) {
    await deps.repo.insertPaymentMethod({
      id: method.id,
      merchantId: deps.config.accountId,
      type: method.type,
      brand: method.card.brand,
      last4: method.card.last4,
      expMonth: method.card.exp_month,
      expYear: method.card.exp_year,
    })
  }
}
