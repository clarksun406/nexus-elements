import { resourceId } from '@nexus-elements/contracts'
import type { SetupIntentRecord } from '../db/types.js'
import type { MerchantContext, ServiceDeps } from './deps.js'
import { publicPaymentMethod, publicSetupIntent } from './present.js'
import { fail, ok, type ApiResult } from './result.js'
import { consumeToken } from './tokens.js'
import { emitEvent, newClientSecret } from './webhooks.js'

export async function createSetupIntent(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const n = await deps.repo.nextSequence('seti')
  const id = resourceId('seti', ctx.mode, n)
  const usage = typeof body.usage === 'string' && body.usage ? body.usage : 'off_session'
  const row: SetupIntentRecord = {
    id,
    merchantId: ctx.merchantId,
    status: 'requires_payment_method',
    clientSecret: newClientSecret(id),
    usage,
    customerEmail: typeof body.customer_email === 'string' ? body.customer_email : undefined,
    created: Math.floor(deps.clock.now() / 1000),
  }
  await deps.repo.insertSetupIntent(row)
  return ok({ setup_intent: publicSetupIntent(row) })
}

export async function confirmSetupIntent(deps: ServiceDeps, ctx: MerchantContext, body: Record<string, unknown>): Promise<ApiResult> {
  const setup = ctx.clientSecret ? await deps.repo.findSetupIntentBySecret(ctx.clientSecret) : null
  if (!setup || setup.merchantId !== ctx.merchantId) {
    return fail(404, 'api_error', 'resource_missing', '未找到对应的 SetupIntent，请检查 client_secret。')
  }
  if (setup.status === 'succeeded') {
    return fail(409, 'api_error', 'setup_intent_already_confirmed', '该 SetupIntent 已成功，请勿重复提交。')
  }
  const tokenKey = typeof body.payment_method_token === 'string' ? body.payment_method_token : ''
  const consumed = await consumeToken(deps, ctx, tokenKey)
  if (!consumed.ok) return consumed.result
  const token = consumed.token
  if (token.outcome.kind === 'decline') {
    setup.status = 'requires_payment_method'
    await deps.repo.saveSetupIntent(setup)
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
  setup.paymentMethod = token.paymentMethodId
  setup.status = 'succeeded'
  await deps.repo.saveSetupIntent(setup)
  if (token.type === 'card') {
    await deps.repo.insertPaymentMethod({
      id: token.paymentMethodId,
      merchantId: ctx.merchantId,
      type: 'card',
      brand: token.brand,
      last4: token.last4,
      expMonth: token.expMonth,
      expYear: token.expYear,
      billingDetails: token.billingDetails,
      customerEmail: setup.customerEmail,
    })
  }
  const setupIntent = publicSetupIntent(setup)
  await emitEvent(deps, ctx.merchantId, 'setup_intent.succeeded', setupIntent)
  const method = token.type === 'card'
    ? publicPaymentMethod({
      id: token.paymentMethodId,
      merchantId: ctx.merchantId,
      type: 'card',
      brand: token.brand,
      last4: token.last4,
      expMonth: token.expMonth,
      expYear: token.expYear,
    })
    : undefined
  return ok({ setup_intent: setupIntent, ...(method ? { payment_method: method } : {}) })
}
