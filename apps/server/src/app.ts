import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { authenticateHeaders, type AuthenticatedMerchant } from './auth/keys.js'
import type { ServerConfig } from './config.js'
import { EncryptionKeys } from './crypto/keys.js'
import { createPostgresRepository } from './db/postgres.js'
import { MemoryRepository } from './db/memory.js'
import type { Repository } from './db/types.js'
import { SandboxChannel } from './gateway/sandbox.js'
import { isCheckoutPath, registerRoutes } from './routes/register.js'
import { seedSavedMethods, systemClock, type Clock, type ServiceDeps } from './services/deps.js'

declare module 'fastify' {
  interface FastifyRequest {
    ctx: AuthenticatedMerchant
    rawBody: string
  }
  interface FastifyInstance {
    deps: ServiceDeps
  }
}

export interface BuildAppOptions {
  repo?: Repository
  clock?: Clock
  keys?: EncryptionKeys
}

export async function buildApp(config: ServerConfig, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-nexus-client-secret"]',
          'req.body.card.number',
          'req.body.card.cvc',
          'req.body.encrypted_card',
          'req.body.encrypted_card.*',
        ],
        censor: '[redacted]',
      },
    },
  })

  const repo = options.repo ?? (config.store === 'postgres'
    ? await createPostgresRepository(config.databaseUrl ?? '')
    : new MemoryRepository())
  const keys = await loadKeys(config, repo, options.keys)
  const deps: ServiceDeps = {
    repo,
    gateway: new SandboxChannel(),
    clock: options.clock ?? systemClock,
    keys,
    config,
  }
  app.decorate('deps', deps)
  await seedSavedMethods(deps)
  app.addHook('onClose', async () => {
    await repo.close()
  })

  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8')
    request.rawBody = text
    if (!text) {
      done(null, {})
      return
    }
    try {
      const parsed = JSON.parse(text) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const error = Object.assign(new Error('JSON body must be an object'), { statusCode: 400 })
        done(error, undefined)
        return
      }
      done(null, parsed)
    } catch {
      const error = Object.assign(new Error('Invalid JSON'), { statusCode: 400, code: 'FST_ERR_CTP_INVALID_JSON' })
      done(error, undefined)
    }
  })

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Nexus-Key', 'X-Nexus-Client-Secret', 'X-Nexus-Account', 'Authorization', 'Idempotency-Key'],
  })

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
    allowList(request) {
      const path = request.url.split('?')[0] ?? ''
      return path === '/health' || path.startsWith('/3ds-mock') || isCheckoutPath(path)
    },
    errorResponseBuilder(_request, context) {
      const error = new Error(`请求过于频繁，请 ${context.after} 后重试。`) as Error & { statusCode: number }
      error.statusCode = context.statusCode
      return error
    },
  })

  app.addHook('onRequest', async (request) => {
    request.rawBody = ''
  })

  app.addHook('preHandler', async (request, reply) => {
    const path = request.url.split('?')[0] ?? ''
    if (!path.startsWith('/v1')) return
    const auth = authenticateHeaders(request.headers, config)
    if (!auth.ok) {
      await reply.code(auth.status).send({ error: { type: 'api_error', code: auth.code, message: auth.message } })
      return
    }
    request.ctx = auth.merchant
  })

  app.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?')[0] ?? ''
    if (path.startsWith('/3ds-mock') || isCheckoutPath(path)) return payload
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    return payload
  })

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? '/'
    const shown = path.startsWith('/v1') ? path.slice(3) : path
    return reply.code(404).send({
      error: { type: 'api_error', code: 'unknown_endpoint', message: `未知接口: ${request.method} ${shown}` },
    })
  })

  app.setErrorHandler((error, request, reply) => {
    const err = error as { statusCode?: number; code?: string; message?: string }
    if (err.code === 'FST_ERR_CTP_INVALID_JSON' || err.message === 'Invalid JSON') {
      return reply.code(400).send({ error: { type: 'validation_error', code: 'invalid_json', message: '请求体不是合法的 JSON。' } })
    }
    if (err.statusCode === 429) {
      return reply.code(429).send({ error: { type: 'api_error', code: 'rate_limited', message: err.message ?? '请求过于频繁。' } })
    }
    request.log.error({ err: error }, 'request failed')
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: { type: 'validation_error', code: 'invalid_request', message: err.message ?? '请求无效。' } })
    }
    return reply.code(500).send({ error: { type: 'api_error', code: 'internal_error', message: '服务器内部错误。' } })
  })

  registerRoutes(app, deps)
  return app
}

async function loadKeys(config: ServerConfig, repo: Repository, provided?: EncryptionKeys): Promise<EncryptionKeys> {
  if (provided) return provided
  if (config.rsaPrivateKeyPem) return new EncryptionKeys(config.encryptionKeyId, config.rsaPrivateKeyPem)
  if (config.store === 'postgres') {
    const stored = await repo.getEncryptionPrivateKey(config.encryptionKeyId)
    const keys = new EncryptionKeys(config.encryptionKeyId, stored ?? undefined)
    if (!stored) await repo.saveEncryptionPrivateKey(config.encryptionKeyId, keys.exportPrivatePem())
    return keys
  }
  return new EncryptionKeys(config.encryptionKeyId)
}
