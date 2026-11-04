import type { MerchantContext, ServiceDeps } from './deps.js'
import { publicPaymentMethod } from './present.js'
import { fail, ok, type ApiResult } from './result.js'

export async function listPaymentMethods(deps: ServiceDeps, ctx: MerchantContext): Promise<ApiResult> {
  const rows = await deps.repo.listPaymentMethods(ctx.merchantId)
  return ok({ data: rows.map(publicPaymentMethod) })
}

export async function getOrder(deps: ServiceDeps, ctx: MerchantContext, id: string): Promise<ApiResult> {
  const order = await deps.repo.findOrder(ctx.merchantId, id)
  if (!order) return fail(404, 'api_error', 'resource_missing', '未找到订单。')
  return ok({ order: order.body })
}

export async function upsertOrder(deps: ServiceDeps, ctx: MerchantContext, id: string, body: Record<string, unknown>): Promise<ApiResult> {
  const order = { id, status: body.status ?? 'pending', ...body }
  await deps.repo.upsertOrder({ id, merchantId: ctx.merchantId, body: order })
  return ok({ order })
}

export async function applePaySession(): Promise<ApiResult> {
  return fail(501, 'api_error', 'apple_pay_unavailable', 'Apple Pay merchant validation is not configured. The wallet button falls back to the demo flow.')
}
