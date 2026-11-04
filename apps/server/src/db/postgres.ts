import pg from 'pg'
import type {
  CheckoutSessionRecord,
  IdempotencyClaim,
  IdempotencyStart,
  LineItem,
  OrderRecord,
  PaymentIntentRecord,
  PaymentMethodRecord,
  Repository,
  SetupIntentRecord,
  TokenRecord,
  WebhookEventRecord,
} from './types.js'
import type { CardOutcome, CheckoutSessionStatus, PaymentIntentStatus, SetupIntentStatus } from '@nexus-elements/contracts'
import { migrate } from './migrate.js'

const { Pool } = pg

export async function createPostgresRepository(databaseUrl: string): Promise<Repository> {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 })
  await migrate(pool)
  return new PostgresRepository(pool)
}

class PostgresRepository implements Repository {
  constructor(private readonly pool: pg.Pool) {}

  async nextSequence(name: 'pi' | 'tok' | 'pm' | 'seti' | 'cs' | 'evt'): Promise<number> {
    const result = await this.pool.query<{ value: string }>(
      `INSERT INTO id_sequences (name, value) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET value = id_sequences.value + 1
       RETURNING value`,
      [name],
    )
    return Number(result.rows[0]?.value)
  }

  async insertPaymentIntent(row: PaymentIntentRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment_intents (
        id, merchant_id, amount, currency, status, client_secret, description, metadata,
        payment_method_types, payment_method, receipt_email, capture_method, created
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13)`,
      intentParams(row),
    )
  }

  async findPaymentIntentById(id: string): Promise<PaymentIntentRecord | null> {
    const result = await this.pool.query('SELECT * FROM payment_intents WHERE id = $1', [id])
    return result.rows[0] ? mapIntent(result.rows[0]) : null
  }

  async findPaymentIntentBySecret(secret: string): Promise<PaymentIntentRecord | null> {
    const result = await this.pool.query('SELECT * FROM payment_intents WHERE client_secret = $1', [secret])
    return result.rows[0] ? mapIntent(result.rows[0]) : null
  }

  async savePaymentIntent(row: PaymentIntentRecord): Promise<void> {
    await this.pool.query(
      `UPDATE payment_intents SET
        amount = $3, currency = $4, status = $5, client_secret = $6, description = $7,
        metadata = $8::jsonb, payment_method_types = $9::jsonb, payment_method = $10,
        receipt_email = $11, capture_method = $12, created = $13
       WHERE id = $1 AND merchant_id = $2`,
      intentParams(row),
    )
  }

  async insertSetupIntent(row: SetupIntentRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO setup_intents (id, merchant_id, status, client_secret, usage, customer_email, payment_method, created)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.merchantId, row.status, row.clientSecret, row.usage, row.customerEmail ?? null, row.paymentMethod ?? null, row.created],
    )
  }

  async findSetupIntentBySecret(secret: string): Promise<SetupIntentRecord | null> {
    const result = await this.pool.query('SELECT * FROM setup_intents WHERE client_secret = $1', [secret])
    return result.rows[0] ? mapSetup(result.rows[0]) : null
  }

  async saveSetupIntent(row: SetupIntentRecord): Promise<void> {
    await this.pool.query(
      `UPDATE setup_intents SET status = $3, client_secret = $4, usage = $5, customer_email = $6, payment_method = $7, created = $8
       WHERE id = $1 AND merchant_id = $2`,
      [row.id, row.merchantId, row.status, row.clientSecret, row.usage, row.customerEmail ?? null, row.paymentMethod ?? null, row.created],
    )
  }

  async insertCheckoutSession(row: CheckoutSessionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO checkout_sessions (
        id, merchant_id, status, mode, ui_mode, amount, currency, line_items, success_url, cancel_url,
        client_secret, url, payment_intent, created
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)`,
      sessionParams(row),
    )
  }

  async findCheckoutSessionById(id: string): Promise<CheckoutSessionRecord | null> {
    const result = await this.pool.query('SELECT * FROM checkout_sessions WHERE id = $1', [id])
    return result.rows[0] ? mapSession(result.rows[0]) : null
  }

  async saveCheckoutSession(row: CheckoutSessionRecord): Promise<void> {
    await this.pool.query(
      `UPDATE checkout_sessions SET status = $3, mode = $4, ui_mode = $5, amount = $6, currency = $7,
        line_items = $8::jsonb, success_url = $9, cancel_url = $10, client_secret = $11, url = $12,
        payment_intent = $13, created = $14
       WHERE id = $1 AND merchant_id = $2`,
      sessionParams(row),
    )
  }

  async insertToken(row: TokenRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO tokens (
        token, payment_method_id, merchant_id, type, brand, last4, exp_month, exp_year, funding, country,
        outcome, pan_fingerprint, redirect_method, billing_details, used, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14::jsonb,$15,$16)`,
      tokenParams(row),
    )
  }

  async findToken(key: string): Promise<TokenRecord | null> {
    const result = await this.pool.query('SELECT * FROM tokens WHERE token = $1 OR payment_method_id = $1', [key])
    return result.rows[0] ? mapToken(result.rows[0]) : null
  }

  async markTokenUsed(token: string): Promise<boolean> {
    const result = await this.pool.query('UPDATE tokens SET used = TRUE WHERE token = $1 AND used = FALSE', [token])
    return (result.rowCount ?? 0) > 0
  }

  async upsertOrder(row: OrderRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO orders (merchant_id, id, body) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (merchant_id, id) DO UPDATE SET body = EXCLUDED.body`,
      [row.merchantId, row.id, JSON.stringify(row.body)],
    )
  }

  async findOrder(merchantId: string, id: string): Promise<OrderRecord | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE merchant_id = $1 AND id = $2', [merchantId, id])
    const row = result.rows[0]
    if (!row) return null
    return { id: row.id as string, merchantId: row.merchant_id as string, body: row.body as Record<string, unknown> }
  }

  async insertPaymentMethod(row: PaymentMethodRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment_methods (id, merchant_id, type, brand, last4, exp_month, exp_year, billing_details, customer_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       ON CONFLICT (merchant_id, id) DO UPDATE SET
         type = EXCLUDED.type, brand = EXCLUDED.brand, last4 = EXCLUDED.last4,
         exp_month = EXCLUDED.exp_month, exp_year = EXCLUDED.exp_year,
         billing_details = EXCLUDED.billing_details, customer_email = EXCLUDED.customer_email`,
      [row.id, row.merchantId, row.type, row.brand ?? null, row.last4 ?? null, row.expMonth ?? null, row.expYear ?? null, row.billingDetails ? JSON.stringify(row.billingDetails) : null, row.customerEmail ?? null],
    )
  }

  async listPaymentMethods(merchantId: string): Promise<PaymentMethodRecord[]> {
    const result = await this.pool.query('SELECT * FROM payment_methods WHERE merchant_id = $1 ORDER BY id', [merchantId])
    return result.rows.map(mapMethod)
  }

  async beginIdempotency(input: IdempotencyStart): Promise<IdempotencyClaim> {
    const inserted = await this.pool.query(
      `INSERT INTO idempotency_keys (merchant_id, idem_key, method, path, request_hash, status_code, response_body)
       VALUES ($1,$2,$3,$4,$5,0,'null'::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING idem_key`,
      [input.merchantId, input.key, input.method, input.path, input.requestHash],
    )
    if ((inserted.rowCount ?? 0) > 0) return { state: 'started' }
    const existing = await this.pool.query('SELECT * FROM idempotency_keys WHERE merchant_id = $1 AND idem_key = $2', [input.merchantId, input.key])
    const row = existing.rows[0]
    if (!row) return { state: 'started' }
    if (row.method !== input.method || row.path !== input.path || row.request_hash !== input.requestHash) {
      return { state: 'conflict', code: 'idempotency_key_in_use', message: 'Idempotency-Key 已用于不同的请求。' }
    }
    if (row.status_code === 0) {
      return { state: 'conflict', code: 'idempotency_key_in_progress', message: '相同 Idempotency-Key 的请求仍在处理中。' }
    }
    return { state: 'replay', status: row.status_code as number, body: row.response_body }
  }

  async finishIdempotency(merchantId: string, key: string, status: number, body: unknown): Promise<void> {
    await this.pool.query(
      'UPDATE idempotency_keys SET status_code = $3, response_body = $4::jsonb WHERE merchant_id = $1 AND idem_key = $2',
      [merchantId, key, status, JSON.stringify(body)],
    )
  }

  async abortIdempotency(merchantId: string, key: string): Promise<void> {
    await this.pool.query('DELETE FROM idempotency_keys WHERE merchant_id = $1 AND idem_key = $2 AND status_code = 0', [merchantId, key])
  }

  async insertWebhookEvent(row: WebhookEventRecord): Promise<void> {
    await this.pool.query(
      'INSERT INTO webhook_events (id, merchant_id, type, payload, created) VALUES ($1,$2,$3,$4::jsonb,$5)',
      [row.id, row.merchantId, row.type, JSON.stringify(row.payload), row.created],
    )
  }

  async listWebhookEvents(merchantId: string): Promise<WebhookEventRecord[]> {
    const result = await this.pool.query('SELECT * FROM webhook_events WHERE merchant_id = $1 ORDER BY created, id', [merchantId])
    return result.rows.map((row) => ({
      id: row.id as string,
      merchantId: row.merchant_id as string,
      type: row.type as string,
      payload: row.payload as Record<string, unknown>,
      created: row.created as number,
    }))
  }

  async getEncryptionPrivateKey(keyId: string): Promise<string | null> {
    const result = await this.pool.query('SELECT private_key_pem FROM encryption_keys WHERE key_id = $1', [keyId])
    return (result.rows[0]?.private_key_pem as string | undefined) ?? null
  }

  async saveEncryptionPrivateKey(keyId: string, pem: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO encryption_keys (key_id, private_key_pem) VALUES ($1,$2) ON CONFLICT (key_id) DO NOTHING',
      [keyId, pem],
    )
  }

  async containsRawValue(value: string): Promise<boolean> {
    const pattern = `%${value}%`
    const tables = [
      'SELECT 1 FROM tokens WHERE token LIKE $1 OR payment_method_id LIKE $1 OR COALESCE(outcome::text, \'\') LIKE $1 OR COALESCE(billing_details::text, \'\') LIKE $1 OR COALESCE(redirect_method::text, \'\') LIKE $1 OR COALESCE(pan_fingerprint, \'\') LIKE $1',
      'SELECT 1 FROM payment_intents WHERE COALESCE(metadata::text, \'\') LIKE $1 OR COALESCE(description, \'\') LIKE $1 OR id LIKE $1',
      'SELECT 1 FROM orders WHERE body::text LIKE $1',
      'SELECT 1 FROM webhook_events WHERE payload::text LIKE $1',
      'SELECT 1 FROM checkout_sessions WHERE line_items::text LIKE $1',
    ]
    for (const sql of tables) {
      const result = await this.pool.query(sql, [pattern])
      if ((result.rowCount ?? 0) > 0) return true
    }
    return false
  }

  async resetBusinessData(): Promise<void> {
    await this.pool.query('TRUNCATE payment_intents, setup_intents, checkout_sessions, tokens, payment_methods, orders, idempotency_keys, webhook_events')
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

function intentParams(row: PaymentIntentRecord): unknown[] {
  return [
    row.id,
    row.merchantId,
    row.amount,
    row.currency,
    row.status,
    row.clientSecret,
    row.description ?? null,
    JSON.stringify(row.metadata ?? {}),
    JSON.stringify(row.paymentMethodTypes),
    row.paymentMethod ?? null,
    row.receiptEmail ?? null,
    row.captureMethod ?? null,
    row.created,
  ]
}

function sessionParams(row: CheckoutSessionRecord): unknown[] {
  return [
    row.id,
    row.merchantId,
    row.status,
    row.mode,
    row.uiMode,
    row.amount,
    row.currency,
    JSON.stringify(row.lineItems),
    row.successUrl ?? null,
    row.cancelUrl ?? null,
    row.clientSecret,
    row.url,
    row.paymentIntent ?? null,
    row.created,
  ]
}

function tokenParams(row: TokenRecord): unknown[] {
  return [
    row.token,
    row.paymentMethodId,
    row.merchantId,
    row.type,
    row.brand ?? null,
    row.last4 ?? null,
    row.expMonth ?? null,
    row.expYear ?? null,
    row.funding ?? null,
    row.country ?? null,
    JSON.stringify(row.outcome),
    row.panFingerprint ?? null,
    row.redirectMethod ? JSON.stringify(row.redirectMethod) : null,
    row.billingDetails ? JSON.stringify(row.billingDetails) : null,
    row.used,
    row.expiresAt,
  ]
}

function mapIntent(row: Record<string, unknown>): PaymentIntentRecord {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    amount: row.amount as number,
    currency: row.currency as string,
    status: row.status as PaymentIntentStatus,
    clientSecret: row.client_secret as string,
    description: (row.description as string | null) ?? undefined,
    metadata: (row.metadata as Record<string, string> | null) ?? undefined,
    paymentMethodTypes: row.payment_method_types as string[],
    paymentMethod: (row.payment_method as string | null) ?? undefined,
    receiptEmail: (row.receipt_email as string | null) ?? undefined,
    captureMethod: (row.capture_method as string | null) ?? undefined,
    created: row.created as number,
  }
}

function mapSetup(row: Record<string, unknown>): SetupIntentRecord {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    status: row.status as SetupIntentStatus,
    clientSecret: row.client_secret as string,
    usage: row.usage as string,
    customerEmail: (row.customer_email as string | null) ?? undefined,
    paymentMethod: (row.payment_method as string | null) ?? undefined,
    created: row.created as number,
  }
}

function mapSession(row: Record<string, unknown>): CheckoutSessionRecord {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    status: row.status as CheckoutSessionStatus,
    mode: row.mode as string,
    uiMode: row.ui_mode as string,
    amount: row.amount as number,
    currency: row.currency as string,
    lineItems: row.line_items as LineItem[],
    successUrl: (row.success_url as string | null) ?? undefined,
    cancelUrl: (row.cancel_url as string | null) ?? undefined,
    clientSecret: row.client_secret as string,
    url: row.url as string,
    paymentIntent: (row.payment_intent as string | null) ?? undefined,
    created: row.created as number,
  }
}

function mapToken(row: Record<string, unknown>): TokenRecord {
  return {
    token: row.token as string,
    paymentMethodId: row.payment_method_id as string,
    merchantId: row.merchant_id as string,
    type: row.type as string,
    brand: (row.brand as string | null) ?? undefined,
    last4: (row.last4 as string | null) ?? undefined,
    expMonth: (row.exp_month as number | null) ?? undefined,
    expYear: (row.exp_year as number | null) ?? undefined,
    funding: (row.funding as string | null) ?? undefined,
    country: (row.country as string | null) ?? undefined,
    outcome: row.outcome as CardOutcome,
    panFingerprint: (row.pan_fingerprint as string | null) ?? undefined,
    redirectMethod: (row.redirect_method as Record<string, unknown> | null) ?? undefined,
    billingDetails: (row.billing_details as Record<string, unknown> | null) ?? undefined,
    used: row.used as boolean,
    expiresAt: Number(row.expires_at),
  }
}

function mapMethod(row: Record<string, unknown>): PaymentMethodRecord {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    type: row.type as string,
    brand: (row.brand as string | null) ?? undefined,
    last4: (row.last4 as string | null) ?? undefined,
    expMonth: (row.exp_month as number | null) ?? undefined,
    expYear: (row.exp_year as number | null) ?? undefined,
    billingDetails: (row.billing_details as Record<string, unknown> | null) ?? undefined,
    customerEmail: (row.customer_email as string | null) ?? undefined,
  }
}
