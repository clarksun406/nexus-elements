import {
  SAVED_PAYMENT_METHODS,
  normalizeCurrency,
  resourceId,
  updateTouchesRestrictedFields,
  validateAmount,
  type PaymentIntentStatus,
} from '@nexus-elements/contracts'
import type { PaymentIntentRecord } from '../db/types.js'
import { assertTransition, canCancel, canConfirm } from './state-machine.js'
import type { MerchantContext, ServiceDeps } from './deps.js'
import { publicPaymentIntent } from './present.js'
import { fail, ok, type ApiResult } from './result.js'
import { consumeToken } from './tokens.js'
import { emitEvent, newClientSecret } from './webhooks.js'

const UPDATABLE = ['amount', 'currency', 'description', 'metadata', 'receipt_email', 'payment_method_types'] as const

export async function createPaymentIntent(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const amount = validateAmount(body.amount)
  if (!amount.ok) return fail(amount.error.status, amount.error.type, amount.error.code, amount.error.message)
  const n = await deps.repo.nextSequence('pi')
  const id = resourceId('pi', ctx.mode, n)
  const intent: PaymentIntentRecord = {
    id,
    merchantId: ctx.merchantId,
    amount: amount.amount,
    currency: normalizeCurrency(body.currency),
    status: 'requires_payment_method',
    clientSecret: newClientSecret(id),
    description: typeof body.description === 'string' ? body.description : undefined,
    metadata: isStringRecord(body.metadata) ? body.metadata : undefined,
    paymentMethodTypes: stringArray(body.payment_method_types) ?? ['card'],
    receiptEmail: typeof body.receipt_email === 'string' ? body.receipt_email : undefined,
    captureMethod: body.capture_method === 'manual' || body.capture_method === 'automatic' ? body.capture_method : undefined,
    created: Math.floor(deps.clock.now() / 1000),
  }
  await deps.repo.insertPaymentIntent(intent)
  return ok({ payment_intent: publicPaymentIntent(intent) })
}

export async function confirmPaymentIntent(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const intent = ctx.clientSecret ? await deps.repo.findPaymentIntentBySecret(ctx.clientSecret) : null
  if (!intent || intent.merchantId !== ctx.merchantId) {
    return fail(404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent，请检查 client_secret。')
  }
  if (intent.status === 'succeeded') {
    return fail(409, 'api_error', 'payment_intent_already_confirmed', '该支付已成功，请勿重复提交。', {
      payment_intent: publicPaymentIntent(intent),
    })
  }
  if (!canConfirm(intent.status)) {
    return fail(409, 'api_error', 'payment_intent_unexpected_state', `当前状态 ${intent.status} 不允许确认支付。`, {
      payment_intent: publicPaymentIntent(intent),
    })
  }

  const tokenKey = typeof body.payment_method_token === 'string' ? body.payment_method_token : ''
  if (tokenKey.startsWith('pm_saved_')) {
    const saved = SAVED_PAYMENT_METHODS.find((entry) => entry.id === tokenKey)
    if (!saved) return fail(400, 'validation_error', 'invalid_token', '未找到对应的已保存支付方式。')
    move(intent, 'succeeded')
    intent.paymentMethod = saved.id
    await deps.repo.savePaymentIntent(intent)
    await emitEvent(deps, ctx.merchantId, 'payment_intent.succeeded', publicPaymentIntent(intent))
    return ok({ payment_intent: publicPaymentIntent(intent) })
  }

  const consumed = await consumeToken(deps, ctx, tokenKey)
  if (!consumed.ok) return consumed.result
  const token = consumed.token
  const authorized = await deps.gateway.authorize({
    amount: intent.amount,
    currency: intent.currency,
    paymentMethodType: token.type,
    outcome: token.outcome,
    merchantId: ctx.merchantId,
    intentId: intent.id,
    returnUrl: typeof body.return_url === 'string' ? body.return_url : '/',
  })
  if (typeof body.receipt_email === 'string') intent.receiptEmail = body.receipt_email

  if (authorized.status === 'declined' && authorized.decline) {
    move(intent, 'requires_payment_method')
    await deps.repo.savePaymentIntent(intent)
    const paymentIntent = publicPaymentIntent(intent)
    await emitEvent(deps, ctx.merchantId, 'payment_intent.payment_failed', paymentIntent)
    return {
      status: 402,
      body: {
        error: {
          type: 'card_error',
          code: authorized.decline.code,
          decline_code: authorized.decline.decline_code,
          message: authorized.decline.message,
          payment_intent: paymentIntent,
        },
      },
    }
  }

  intent.paymentMethod = token.paymentMethodId
  if (authorized.status === 'requires_action') {
    move(intent, 'requires_action')
    await deps.repo.savePaymentIntent(intent)
    await emitEvent(deps, ctx.merchantId, 'payment_intent.requires_action', publicPaymentIntent(intent))
    return ok({
      payment_intent: publicPaymentIntent(intent),
      next_action: { type: 'redirect', redirect_url: authorized.redirectUrl },
    })
  }

  move(intent, 'succeeded')
  await deps.repo.savePaymentIntent(intent)
  await emitEvent(deps, ctx.merchantId, 'payment_intent.succeeded', publicPaymentIntent(intent))
  return ok({ payment_intent: publicPaymentIntent(intent) })
}

export async function updatePaymentIntent(deps: ServiceDeps, ctx: MerchantContext, id: string, body: Record<string, unknown>): Promise<ApiResult> {
  const intent = await deps.repo.findPaymentIntentById(id)
  if (!intent || intent.merchantId !== ctx.merchantId) {
    return fail(404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
  }
  if (intent.status !== 'requires_payment_method' && updateTouchesRestrictedFields(body)) {
    return fail(409, 'api_error', 'payment_intent_unexpected_state', '当前状态不允许修改金额/币种/支付方式。')
  }
  if (body.amount !== undefined) {
    const amount = validateAmount(body.amount)
    if (!amount.ok) return fail(amount.error.status, amount.error.type, amount.error.code, amount.error.message)
    intent.amount = amount.amount
  }
  for (const field of UPDATABLE) {
    if (field === 'amount' || body[field] === undefined) continue
    if (field === 'currency') intent.currency = normalizeCurrency(body.currency)
    else if (field === 'description' && typeof body.description === 'string') intent.description = body.description
    else if (field === 'metadata' && isStringRecord(body.metadata)) intent.metadata = body.metadata
    else if (field === 'receipt_email' && typeof body.receipt_email === 'string') intent.receiptEmail = body.receipt_email
    else if (field === 'payment_method_types') {
      const types = stringArray(body.payment_method_types)
      if (types) intent.paymentMethodTypes = types
    }
  }
  await deps.repo.savePaymentIntent(intent)
  return ok({ payment_intent: publicPaymentIntent(intent) })
}

export async function cancelPaymentIntent(deps: ServiceDeps, ctx: MerchantContext, id: string): Promise<ApiResult> {
  const intent = await deps.repo.findPaymentIntentById(id)
  if (!intent || intent.merchantId !== ctx.merchantId) {
    return fail(404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
  }
  if (!canCancel(intent.status)) {
    return fail(409, 'api_error', 'payment_intent_unexpected_state', '已成功的支付不能取消。')
  }
  move(intent, 'canceled')
  await deps.repo.savePaymentIntent(intent)
  await emitEvent(deps, ctx.merchantId, 'payment_intent.canceled', publicPaymentIntent(intent))
  return ok({ payment_intent: publicPaymentIntent(intent) })
}

export async function completeThreeDs(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const id = typeof body.intent === 'string' ? body.intent : ''
  const intent = id ? await deps.repo.findPaymentIntentById(id) : null
  if (intent && intent.merchantId === ctx.merchantId && intent.status === 'requires_action') {
    const next: PaymentIntentStatus = body.status === 'approved' ? 'succeeded' : 'requires_payment_method'
    move(intent, next)
    await deps.repo.savePaymentIntent(intent)
    const event = next === 'succeeded' ? 'payment_intent.succeeded' : 'payment_intent.payment_failed'
    await emitEvent(deps, ctx.merchantId, event, publicPaymentIntent(intent))
  }
  return ok({ ok: true })
}

function move(intent: PaymentIntentRecord, next: PaymentIntentStatus): void {
  if (intent.status === next) return
  assertTransition(intent.status, next)
  intent.status = next
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return undefined
  return value
}
