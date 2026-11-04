import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { ServerConfig } from '../config.js'
import { checkoutPage, isCheckoutPath, threeDsPage } from '../pages/html.js'
import { runIdempotent } from '../services/idempotency.js'
import { applePaySession, getOrder, listPaymentMethods, upsertOrder } from '../services/orders.js'
import {
  cancelPaymentIntent,
  completeThreeDs,
  confirmPaymentIntent,
  createPaymentIntent,
  updatePaymentIntent,
} from '../services/payment-intents.js'
import { confirmCheckoutSession, createCheckoutSession, getCheckoutSession } from '../services/checkout.js'
import { confirmSetupIntent, createSetupIntent } from '../services/setup-intents.js'
import { createToken } from '../services/tokens.js'
import type { ServiceDeps } from '../services/deps.js'
import { fail, type ApiResult } from '../services/result.js'

export function registerRoutes(app: FastifyInstance, deps: ServiceDeps): void {
  const { config } = deps

  app.get('/health', async () => ({ status: 'ok', store: config.store }))

  app.get('/3ds-mock', async (request, reply) => {
    const params = new URL(request.url, 'http://localhost').searchParams
    frameable(reply, config)
    return reply.type('text/html; charset=utf-8').send(threeDsPage(params.get('intent') ?? '', params.get('return_url') ?? '/', config.publishableKey))
  })

  app.get('/__nexus-checkout', checkout)
  app.get('/__nexus-checkout/', checkout)
  app.get('/__nexus-checkout/index.html', checkout)

  function checkout(_request: FastifyRequest, reply: FastifyReply) {
    frameable(reply, config)
    return reply.type('text/html; charset=utf-8').send(checkoutPage(config.publishableKey))
  }

  const tokenLimit = { config: { rateLimit: { max: config.tokenRateLimitMax, timeWindow: config.rateLimitWindowMs } } }

  app.post('/v1/tokens', tokenLimit, async (request, reply) => {
    return respond(reply, await idempotent(deps, request, () => createToken(deps, request.ctx, bodyOf(request))))
  })

  app.get('/v1/payment_methods', async (request, reply) => {
    return respond(reply, await listPaymentMethods(deps, request.ctx))
  })

  app.get('/v1/encryption_key', async () => deps.keys.describe(Math.floor(deps.clock.now() / 1000)))

  app.post('/v1/payment_intents', async (request, reply) => {
    const denied = requireSecret(request, config)
    if (denied) return respond(reply, denied)
    return respond(reply, await idempotent(deps, request, () => createPaymentIntent(deps, request.ctx, bodyOf(request))))
  })

  app.post('/v1/payment_intents/confirm', async (request, reply) => {
    return respond(reply, await idempotent(deps, request, () => confirmPaymentIntent(deps, request.ctx, bodyOf(request))))
  })

  app.post('/v1/payment_intents/:id/cancel', async (request, reply) => {
    const id = (request.params as { id: string }).id
    return respond(reply, await idempotent(deps, request, () => cancelPaymentIntent(deps, request.ctx, id)))
  })

  app.post('/v1/payment_intents/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id
    return respond(reply, await idempotent(deps, request, () => updatePaymentIntent(deps, request.ctx, id, bodyOf(request))))
  })

  app.post('/v1/setup_intents', async (request, reply) => {
    const denied = requireSecret(request, config)
    if (denied) return respond(reply, denied)
    return respond(reply, await idempotent(deps, request, () => createSetupIntent(deps, request.ctx, bodyOf(request))))
  })

  app.post('/v1/setup_intents/confirm', async (request, reply) => {
    return respond(reply, await idempotent(deps, request, () => confirmSetupIntent(deps, request.ctx, bodyOf(request))))
  })

  app.post('/v1/checkout/sessions', async (request, reply) => {
    const denied = requireSecret(request, config)
    if (denied) return respond(reply, denied)
    return respond(reply, await idempotent(deps, request, () => createCheckoutSession(deps, request.ctx, bodyOf(request))))
  })

  app.get('/v1/checkout/sessions/:id', async (request, reply) => {
    return respond(reply, await getCheckoutSession(deps, request.ctx, (request.params as { id: string }).id))
  })

  app.post('/v1/checkout/sessions/:id/confirm', async (request, reply) => {
    const id = (request.params as { id: string }).id
    return respond(reply, await idempotent(deps, request, () => confirmCheckoutSession(deps, request.ctx, id, bodyOf(request))))
  })

  app.get('/v1/orders/:id', async (request, reply) => {
    return respond(reply, await getOrder(deps, request.ctx, decodeURIComponent((request.params as { id: string }).id)))
  })

  app.post('/v1/orders/:id', async (request, reply) => {
    const id = decodeURIComponent((request.params as { id: string }).id)
    return respond(reply, await idempotent(deps, request, () => upsertOrder(deps, request.ctx, id, bodyOf(request))))
  })

  app.post('/v1/apple_pay/sessions', async (_request, reply) => respond(reply, await applePaySession()))

  app.post('/v1/3ds/complete', async (request, reply) => {
    return respond(reply, await idempotent(deps, request, () => completeThreeDs(deps, request.ctx, bodyOf(request))))
  })
}

function bodyOf(request: FastifyRequest): Record<string, unknown> {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return body as Record<string, unknown>
}

function pathOf(request: FastifyRequest): string {
  return request.url.split('?')[0] ?? request.url
}

function idempotent(deps: ServiceDeps, request: FastifyRequest, fn: () => Promise<ApiResult>): Promise<ApiResult> {
  const keyHeader = request.headers['idempotency-key']
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader
  return runIdempotent(deps, request.ctx.merchantId, key, request.method, pathOf(request), request.rawBody ?? '', fn)
}

function requireSecret(request: FastifyRequest, config: ServerConfig): ApiResult | null {
  if (!config.allowPublishableCreates && request.ctx.auth !== 'secret') {
    return fail(401, 'api_error', 'publishable_key_not_allowed', '创建资源需要密钥 sk_。')
  }
  return null
}

function respond(reply: FastifyReply, result: ApiResult) {
  return reply.code(result.status).send(result.body)
}

function frameable(reply: FastifyReply, config: ServerConfig): void {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('Referrer-Policy', 'no-referrer')
  reply.header(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors ${config.frameAncestors}; base-uri 'none'`,
  )
  if (config.frameAncestors.trim() === "'self'") reply.header('X-Frame-Options', 'SAMEORIGIN')
}

export { isCheckoutPath }
