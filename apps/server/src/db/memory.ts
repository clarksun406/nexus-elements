import type {
  CheckoutSessionRecord,
  IdempotencyClaim,
  IdempotencyStart,
  OrderRecord,
  PaymentIntentRecord,
  PaymentMethodRecord,
  Repository,
  SetupIntentRecord,
  TokenRecord,
  WebhookEventRecord,
} from './types.js'

interface IdempotencyRow {
  method: string
  path: string
  requestHash: string
  status: number
  body: unknown
}

export class MemoryRepository implements Repository {
  private sequences = new Map<string, number>()
  private intents = new Map<string, PaymentIntentRecord>()
  private setups = new Map<string, SetupIntentRecord>()
  private sessions = new Map<string, CheckoutSessionRecord>()
  private tokens = new Map<string, TokenRecord>()
  private orders = new Map<string, OrderRecord>()
  private methods: PaymentMethodRecord[] = []
  private idempotency = new Map<string, IdempotencyRow>()
  private events: WebhookEventRecord[] = []
  private keys = new Map<string, string>()

  async nextSequence(name: 'pi' | 'tok' | 'pm' | 'seti' | 'cs' | 'evt'): Promise<number> {
    const next = (this.sequences.get(name) ?? 0) + 1
    this.sequences.set(name, next)
    return next
  }

  async insertPaymentIntent(row: PaymentIntentRecord): Promise<void> {
    this.intents.set(row.id, row)
  }

  async findPaymentIntentById(id: string): Promise<PaymentIntentRecord | null> {
    return this.intents.get(id) ?? null
  }

  async findPaymentIntentBySecret(secret: string): Promise<PaymentIntentRecord | null> {
    for (const row of this.intents.values()) {
      if (row.clientSecret === secret) return row
    }
    return null
  }

  async savePaymentIntent(row: PaymentIntentRecord): Promise<void> {
    this.intents.set(row.id, row)
  }

  async insertSetupIntent(row: SetupIntentRecord): Promise<void> {
    this.setups.set(row.id, row)
  }

  async findSetupIntentBySecret(secret: string): Promise<SetupIntentRecord | null> {
    for (const row of this.setups.values()) {
      if (row.clientSecret === secret) return row
    }
    return null
  }

  async saveSetupIntent(row: SetupIntentRecord): Promise<void> {
    this.setups.set(row.id, row)
  }

  async insertCheckoutSession(row: CheckoutSessionRecord): Promise<void> {
    this.sessions.set(row.id, row)
  }

  async findCheckoutSessionById(id: string): Promise<CheckoutSessionRecord | null> {
    return this.sessions.get(id) ?? null
  }

  async saveCheckoutSession(row: CheckoutSessionRecord): Promise<void> {
    this.sessions.set(row.id, row)
  }

  async insertToken(row: TokenRecord): Promise<void> {
    this.tokens.set(row.token, row)
  }

  async findToken(key: string): Promise<TokenRecord | null> {
    for (const row of this.tokens.values()) {
      if (row.token === key || row.paymentMethodId === key) return row
    }
    return null
  }

  async markTokenUsed(token: string): Promise<boolean> {
    const row = this.tokens.get(token)
    if (!row || row.used) return false
    row.used = true
    return true
  }

  async upsertOrder(row: OrderRecord): Promise<void> {
    this.orders.set(`${row.merchantId}:${row.id}`, row)
  }

  async findOrder(merchantId: string, id: string): Promise<OrderRecord | null> {
    return this.orders.get(`${merchantId}:${id}`) ?? null
  }

  async insertPaymentMethod(row: PaymentMethodRecord): Promise<void> {
    const index = this.methods.findIndex((entry) => entry.id === row.id && entry.merchantId === row.merchantId)
    if (index >= 0) this.methods[index] = row
    else this.methods.push(row)
  }

  async listPaymentMethods(merchantId: string): Promise<PaymentMethodRecord[]> {
    return this.methods.filter((entry) => entry.merchantId === merchantId)
  }

  async beginIdempotency(input: IdempotencyStart): Promise<IdempotencyClaim> {
    const mapKey = `${input.merchantId}:${input.key}`
    const existing = this.idempotency.get(mapKey)
    if (!existing) {
      this.idempotency.set(mapKey, {
        method: input.method,
        path: input.path,
        requestHash: input.requestHash,
        status: 0,
        body: null,
      })
      return { state: 'started' }
    }
    return this.claimFrom(existing, input)
  }

  async finishIdempotency(merchantId: string, key: string, status: number, body: unknown): Promise<void> {
    const row = this.idempotency.get(`${merchantId}:${key}`)
    if (!row) return
    row.status = status
    row.body = body
  }

  async abortIdempotency(merchantId: string, key: string): Promise<void> {
    const mapKey = `${merchantId}:${key}`
    const row = this.idempotency.get(mapKey)
    if (row && row.status === 0) this.idempotency.delete(mapKey)
  }

  async insertWebhookEvent(row: WebhookEventRecord): Promise<void> {
    this.events.push(row)
  }

  async listWebhookEvents(merchantId: string): Promise<WebhookEventRecord[]> {
    return this.events.filter((event) => event.merchantId === merchantId)
  }

  async getEncryptionPrivateKey(keyId: string): Promise<string | null> {
    return this.keys.get(keyId) ?? null
  }

  async saveEncryptionPrivateKey(keyId: string, pem: string): Promise<void> {
    if (!this.keys.has(keyId)) this.keys.set(keyId, pem)
  }

  async containsRawValue(value: string): Promise<boolean> {
    const snapshot = {
      intents: [...this.intents.values()],
      setups: [...this.setups.values()],
      sessions: [...this.sessions.values()],
      tokens: [...this.tokens.values()],
      orders: [...this.orders.values()],
      methods: this.methods,
      events: this.events,
    }
    return JSON.stringify(snapshot).includes(value)
  }

  async resetBusinessData(): Promise<void> {
    this.intents.clear()
    this.setups.clear()
    this.sessions.clear()
    this.tokens.clear()
    this.orders.clear()
    this.methods = []
    this.idempotency.clear()
    this.events = []
  }

  async close(): Promise<void> {}

  private claimFrom(existing: IdempotencyRow, input: IdempotencyStart): IdempotencyClaim {
    if (existing.method !== input.method || existing.path !== input.path || existing.requestHash !== input.requestHash) {
      return { state: 'conflict', code: 'idempotency_key_in_use', message: 'Idempotency-Key 已用于不同的请求。' }
    }
    if (existing.status === 0) {
      return { state: 'conflict', code: 'idempotency_key_in_progress', message: '相同 Idempotency-Key 的请求仍在处理中。' }
    }
    return { state: 'replay', status: existing.status, body: existing.body }
  }
}
