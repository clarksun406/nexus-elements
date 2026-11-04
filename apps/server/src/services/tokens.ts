import { TOKEN_TTL_MS, classifyPan, resourceId, validateCardPayload } from '@nexus-elements/contracts'
import { panFingerprint } from '../crypto/fingerprint.js'
import type { TokenRecord } from '../db/types.js'
import type { MerchantContext, ServiceDeps } from './deps.js'
import { publicToken } from './present.js'
import { fail, ok, type ApiResult } from './result.js'

export async function createToken(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  let payload = body
  if (body.encrypted_card && !body.card) {
    const encrypted = body.encrypted_card
    if (!encrypted || typeof encrypted !== 'object') {
      return fail(400, 'validation_error', 'decryption_failed', '无法解密卡数据。')
    }
    const card = deps.keys.decryptCard(encrypted as { key_id?: string; ek?: string; iv?: string; ciphertext?: string })
    if (!card) return fail(400, 'validation_error', 'decryption_failed', '无法解密卡数据。')
    payload = { ...body, card }
  }

  const paymentMethodType = typeof payload.payment_method_type === 'string' ? payload.payment_method_type : undefined
  if (paymentMethodType) {
    const row = await issueToken(deps, ctx, {
      type: paymentMethodType,
      outcome: { kind: 'success' },
      redirectMethod: isRecord(payload[paymentMethodType]) ? payload[paymentMethodType] as Record<string, unknown> : undefined,
      billingDetails: isRecord(payload.billing_details) ? payload.billing_details : undefined,
    })
    return ok(publicToken(row))
  }

  const validated = validateCardPayload(payload.card, new Date(deps.clock.now()))
  if (!validated.ok) {
    return fail(validated.error.status, validated.error.type, validated.error.code, validated.error.message)
  }
  const card = validated.card
  const row = await issueToken(deps, ctx, {
    type: 'card',
    outcome: classifyPan(card.number),
    brand: card.brand,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
    funding: card.funding,
    country: card.country,
    panFingerprint: panFingerprint(deps.config.webhookSecret, card.number),
    billingDetails: isRecord(payload.billing_details) ? payload.billing_details : undefined,
  })
  return ok(publicToken(row))
}

async function issueToken(deps: ServiceDeps, ctx: MerchantContext, fields: Omit<TokenRecord, 'token' | 'paymentMethodId' | 'merchantId' | 'used' | 'expiresAt'>): Promise<TokenRecord> {
  const n = await deps.repo.nextSequence('tok')
  const pm = await deps.repo.nextSequence('pm')
  const row: TokenRecord = {
    ...fields,
    token: resourceId('tok', ctx.mode, n),
    paymentMethodId: resourceId('pm', ctx.mode, pm),
    merchantId: ctx.merchantId,
    used: false,
    expiresAt: deps.clock.now() + TOKEN_TTL_MS,
  }
  await deps.repo.insertToken(row)
  return row
}

export async function consumeToken(deps: ServiceDeps, ctx: MerchantContext, tokenKey: string): Promise<{ ok: true; token: TokenRecord } | { ok: false; result: ApiResult }> {
  const token = tokenKey ? await deps.repo.findToken(tokenKey) : null
  if (!token || token.merchantId !== ctx.merchantId) {
    return { ok: false, result: fail(400, 'validation_error', 'invalid_token', '支付 token 无效或已过期。') }
  }
  if (token.used) {
    return { ok: false, result: fail(400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。') }
  }
  if (deps.clock.now() > token.expiresAt) {
    return { ok: false, result: fail(400, 'validation_error', 'token_expired', 'token 已过期（5分钟有效），请重新提交卡信息。') }
  }
  const marked = await deps.repo.markTokenUsed(token.token)
  if (!marked) {
    return { ok: false, result: fail(400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。') }
  }
  token.used = true
  return { ok: true, token }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
