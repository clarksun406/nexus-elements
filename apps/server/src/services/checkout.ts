import { normalizeCurrency, resourceId, validateAmount } from '@nexus-elements/contracts'
import type { CheckoutSessionRecord, LineItem, PaymentIntentRecord } from '../db/types.js'
import type { MerchantContext, ServiceDeps } from './deps.js'
import { publicCheckoutSession } from './present.js'
import { fail, ok, type ApiResult } from './result.js'
import { consumeToken } from './tokens.js'
import { emitEvent, newClientSecret } from './webhooks.js'

export async function createCheckoutSession(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const amount = validateAmount(body.amount)
  if (!amount.ok) return fail(amount.error.status, amount.error.type, amount.error.code, amount.error.message)
  const n = await deps.repo.nextSequence('cs')
  const id = resourceId('cs', ctx.mode, n)
  const clientSecret = newClientSecret(id)
  const path = `/__nexus-checkout/index.html?clientSecret=${encodeURIComponent(clientSecret)}`
  const row: CheckoutSessionRecord = {
    id,
    merchantId: ctx.merchantId,
    status: 'open',
    mode: typeof body.mode === 'string' && body.mode ? body.mode : 'payment',
    uiMode: typeof body.ui_mode === 'string' && body.ui_mode ? body.ui_mode : 'embedded',
    amount: amount.amount,
    currency: normalizeCurrency(body.currency),
    lineItems: lineItems(body.line_items),
    successUrl: typeof body.success_url === 'string' ? body.success_url : undefined,
    cancelUrl: typeof body.cancel_url === 'string' ? body.cancel_url : undefined,
    clientSecret,
    url: deps.config.publicBaseUrl ? `${deps.config.publicBaseUrl}${path}` : path,
    created: Math.floor(deps.clock.now() / 1000),
  }
  await deps.repo.insertCheckoutSession(row)
  return ok({ checkout_session: publicCheckoutSession(row) })
}

export async function getCheckoutSession(deps: ServiceDeps, ctx: MerchantContext, id: string): Promise<ApiResult> {
  const session = await loadAuthorized(deps, ctx, id)
  if (!session.ok) return session.result
  return ok({ checkout_session: publicCheckoutSession(session.session) })
}

export async function confirmCheckoutSession(deps: ServiceDeps, ctx: MerchantContext, id: string, body: Record<string, unknown>): Promise<ApiResult> {
  const loaded = await loadAuthorized(deps, ctx, id)
  if (!loaded.ok) return loaded.result
  const session = loaded.session
  if (session.status !== 'open') {
    return fail(409, 'api_error', 'session_not_open', `当前状态 ${session.status} 不允许支付。`)
  }
  const tokenKey = typeof body.payment_method_token === 'string' ? body.payment_method_token : ''
  const consumed = await consumeToken(deps, ctx, tokenKey)
  if (!consumed.ok) return consumed.result
  const token = consumed.token
  if (token.outcome.kind === 'decline') {
    return {
      status: 402,
      body: {
        error: {
          type: 'card_error',
          code: token.outcome.code,
          decline_code: token.outcome.decline_code,
          message: token.outcome.message,
        },
      },
    }
  }
  // The hosted checkout page in the SDK contract does not run 3DS. A card that
  // would challenge on PaymentIntent confirm (4000000000003220) still completes
  // the session, matching mock-api.
  const pi = await deps.repo.nextSequence('pi')
  const intentId = resourceId('pi', ctx.mode, pi)
  const intent: PaymentIntentRecord = {
    id: intentId,
    merchantId: ctx.merchantId,
    amount: session.amount,
    currency: session.currency,
    status: 'succeeded',
    clientSecret: newClientSecret(intentId),
    paymentMethodTypes: ['card'],
    paymentMethod: token.paymentMethodId,
    created: Math.floor(deps.clock.now() / 1000),
  }
  await deps.repo.insertPaymentIntent(intent)
  session.status = 'complete'
  session.paymentIntent = intent.id
  await deps.repo.saveCheckoutSession(session)
  const checkoutSession = publicCheckoutSession(session)
  await emitEvent(deps, ctx.merchantId, 'checkout.session.completed', checkoutSession)
  return ok({ checkout_session: checkoutSession })
}

async function loadAuthorized(
  deps: ServiceDeps,
  ctx: MerchantContext,
  id: string,
): Promise<{ ok: true; session: CheckoutSessionRecord } | { ok: false; result: ApiResult }> {
  const session = await deps.repo.findCheckoutSessionById(id)
  if (!session || session.merchantId !== ctx.merchantId) {
    return { ok: false, result: fail(404, 'api_error', 'resource_missing', '未找到对应的 Checkout Session。') }
  }
  if (ctx.clientSecret !== session.clientSecret) {
    return { ok: false, result: fail(401, 'api_error', 'invalid_client_secret', 'client_secret 无效。') }
  }
  return { ok: true, session }
}

function lineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is LineItem => Boolean(item) && typeof item === 'object')
}
