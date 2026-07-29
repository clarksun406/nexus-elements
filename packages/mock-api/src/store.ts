import type { MockPaymentIntent, MockToken, MockSetupIntent, MockCheckoutSession } from './types.js'

export class MockStore {
  intentCounter = 0
  tokenCounter = 0
  setupCounter = 0
  checkoutCounter = 0

  intents = new Map<string, MockPaymentIntent>()
  tokens = new Map<string, MockToken>()
  setupIntents = new Map<string, MockSetupIntent>()
  checkoutSessions = new Map<string, MockCheckoutSession>()

  reset(): void {
    this.intentCounter = 0
    this.tokenCounter = 0
    this.setupCounter = 0
    this.checkoutCounter = 0
    this.intents.clear()
    this.tokens.clear()
    this.setupIntents.clear()
    this.checkoutSessions.clear()
  }
}
