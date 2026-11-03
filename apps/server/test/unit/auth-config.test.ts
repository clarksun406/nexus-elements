import { describe, expect, it } from 'vitest'
import { authenticateHeaders } from '../../src/auth/keys.js'
import { loadConfig } from '../../src/config.js'
import { hashRequest, runIdempotent } from '../../src/services/idempotency.js'
import { MemoryRepository } from '../../src/db/memory.js'
import { ok } from '../../src/services/result.js'
import type { ServiceDeps } from '../../src/services/deps.js'
import { PUBLISHABLE_KEY, SECRET_KEY, testConfig } from '../helpers.js'

const config = testConfig()

describe('auth edge cases', () => {
  it('accepts the configured publishable key', () => {
    const result = authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY }, config)
    expect(result.ok && result.merchant.auth).toBe('publishable')
  })

  it('accepts a repeated publishable-key header', () => {
    const result = authenticateHeaders({ 'x-nexus-key': [PUBLISHABLE_KEY, 'pk_test_other'] }, config)
    expect(result.ok).toBe(true)
  })

  it('accepts the secret key and ignores a blank publishable key', () => {
    const result = authenticateHeaders({ authorization: `Bearer ${SECRET_KEY}`, 'x-nexus-key': '' }, config)
    expect(result.ok && result.merchant.auth).toBe('secret')
  })

  it('keeps the client secret on the merchant context', () => {
    const result = authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-client-secret': 'pi_test_1_secret_abc' }, config)
    expect(result.ok && result.merchant.clientSecret).toBe('pi_test_1_secret_abc')
  })

  it('accepts a matching account header', () => {
    const result = authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-account': 'acct_test_default' }, config)
    expect(result.ok).toBe(true)
  })

  it('rejects a missing key', () => {
    expect(authenticateHeaders({}, config)).toMatchObject({ ok: false, status: 401, code: 'invalid_api_key' })
  })

  it('rejects an unknown publishable key', () => {
    expect(authenticateHeaders({ 'x-nexus-key': 'pk_test_other' }, config)).toMatchObject({ status: 401 })
  })

  it('rejects a live key on a test deployment', () => {
    expect(authenticateHeaders({ 'x-nexus-key': 'pk_live_merchant' }, config)).toMatchObject({ status: 401 })
  })

  it('rejects a secret key from the other mode', () => {
    expect(authenticateHeaders({ authorization: 'Bearer sk_live_merchant' }, config)).toMatchObject({ status: 401 })
  })

  it('rejects a bearer token that is not a secret key', () => {
    expect(authenticateHeaders({ authorization: `Bearer ${PUBLISHABLE_KEY}` }, config)).toMatchObject({ status: 401 })
  })

  it('rejects a malformed authorization header', () => {
    expect(authenticateHeaders({ authorization: SECRET_KEY }, config)).toMatchObject({ status: 401 })
    expect(authenticateHeaders({ authorization: 'Bearer' }, config)).toMatchObject({ status: 401 })
  })

  it('rejects an account that does not match the key', () => {
    expect(authenticateHeaders({ 'x-nexus-key': PUBLISHABLE_KEY, 'x-nexus-account': 'acct_other' }, config)).toMatchObject({
      status: 403,
      code: 'account_invalid',
    })
  })
})

describe('config parsing', () => {
  it('fills sample keys and trims CORS origins', () => {
    const parsed = loadConfig({ env: { CORS_ORIGINS: ' http://a.test , ,http://b.test ' }, enforceProduction: false })
    expect(parsed.publishableKey).toBe(PUBLISHABLE_KEY)
    expect(parsed.corsOrigins).toEqual(['http://a.test', 'http://b.test'])
    expect(parsed.store).toBe('memory')
    expect(parsed.host).toBe('0.0.0.0')
    expect(parsed.port).toBe(3001)
  })

  it('selects postgres when DATABASE_URL is set and STORE is unset', () => {
    const parsed = loadConfig({ env: { DATABASE_URL: 'postgres://localhost/nexus' }, enforceProduction: false })
    expect(parsed.store).toBe('postgres')
    expect(parsed.databaseUrl).toBe('postgres://localhost/nexus')
  })

  it('strips a trailing slash from the public base url and keeps the webhook url', () => {
    const parsed = loadConfig({
      env: { PUBLIC_BASE_URL: 'https://api.test/', NEXUS_WEBHOOK_URL: 'https://hooks.test/nexus', STORE: 'memory' },
      enforceProduction: false,
    })
    expect(parsed.publicBaseUrl).toBe('https://api.test')
    expect(parsed.webhookUrl).toBe('https://hooks.test/nexus')
  })

  it('disables publishable creates when the flag is false', () => {
    expect(loadConfig({ env: { ALLOW_PUBLISHABLE_CREATES: 'false', STORE: 'memory' }, enforceProduction: false }).allowPublishableCreates).toBe(false)
  })

  it('derives live mode from a live key pair', () => {
    const parsed = loadConfig({
      env: { NEXUS_PUBLISHABLE_KEY: 'pk_live_merchant', NEXUS_SECRET_KEY: 'sk_live_merchant', STORE: 'memory', LOG_LEVEL: 'warn' },
      enforceProduction: false,
    })
    expect(parsed.mode).toBe('live')
    expect(parsed.logLevel).toBe('warn')
    expect(parsed.encryptionKeyId).toBe('ek_test_rsa_oaep')
  })

  it('rejects a publishable key with the wrong prefix', () => {
    expect(() => loadConfig({ env: { NEXUS_PUBLISHABLE_KEY: 'sk_test_nope' }, enforceProduction: false })).toThrow(/pk_test_/)
  })

  it('rejects a secret key in the other mode', () => {
    expect(() => loadConfig({
      env: { NEXUS_PUBLISHABLE_KEY: 'pk_live_a', NEXUS_SECRET_KEY: 'sk_test_a' },
      enforceProduction: false,
    })).toThrow(/same mode/)
  })

  it('requires DATABASE_URL for the postgres store', () => {
    expect(() => loadConfig({ env: { STORE: 'postgres' }, enforceProduction: false })).toThrow(/DATABASE_URL/)
  })

  it('rejects a non-integer port and a non-positive rate limit', () => {
    expect(() => loadConfig({ env: { PORT: 'abc', STORE: 'memory' }, enforceProduction: false })).toThrow(/PORT/)
    expect(() => loadConfig({ env: { RATE_LIMIT_MAX: '0', STORE: 'memory' }, enforceProduction: false })).toThrow(/RATE_LIMIT_MAX/)
    expect(() => loadConfig({ env: { TOKEN_RATE_LIMIT_MAX: '1.5', STORE: 'memory' }, enforceProduction: false })).toThrow(/TOKEN_RATE_LIMIT_MAX/)
  })

  it('refuses to boot production with missing or sample secrets', () => {
    expect(() => loadConfig({ env: { NODE_ENV: 'production' }, enforceProduction: true })).toThrow(/required/)
    expect(() => loadConfig({
      env: {
        NODE_ENV: 'production',
        NEXUS_PUBLISHABLE_KEY: 'pk_test_real',
        NEXUS_SECRET_KEY: SECRET_KEY,
        NEXUS_WEBHOOK_SECRET: 'whsec_real',
      },
    })).toThrow(/sample secret/)
  })

  it('accepts an explicit production key pair', () => {
    const parsed = loadConfig({
      env: {
        NODE_ENV: 'production',
        NEXUS_PUBLISHABLE_KEY: 'pk_live_real',
        NEXUS_SECRET_KEY: 'sk_live_real',
        NEXUS_WEBHOOK_SECRET: 'whsec_real',
        NEXUS_RSA_PRIVATE_KEY: 'pem',
        NEXUS_ACCOUNT_ID: 'acct_live',
        NEXUS_FRAME_ANCESTORS: "'self'",
      },
    })
    expect(parsed.accountId).toBe('acct_live')
    expect(parsed.rsaPrivateKeyPem).toBe('pem')
    expect(parsed.frameAncestors).toBe("'self'")
    expect(parsed.webhookSecret).toBe('whsec_real')
  })
})

describe('idempotency conflicts', () => {
  it('hashes the raw body', () => {
    expect(hashRequest('{"a":1}')).toHaveLength(64)
    expect(hashRequest('{"a":1}')).not.toBe(hashRequest('{"a":2}'))
  })

  it('replays a finished key and conflicts when the body changes', async () => {
    const repo = new MemoryRepository()
    const deps = { repo } as ServiceDeps
    const first = await runIdempotent(deps, 'acct', 'key', 'POST', '/v1/payment_intents', '{"amount":1}', async () => ok({ n: 1 }))
    expect(first.body).toEqual({ n: 1 })
    const replay = await runIdempotent(deps, 'acct', 'key', 'POST', '/v1/payment_intents', '{"amount":1}', async () => ok({ n: 2 }))
    expect(replay.body).toEqual({ n: 1 })
    const conflict = await runIdempotent(deps, 'acct', 'key', 'POST', '/v1/payment_intents', '{"amount":2}', async () => ok({ n: 3 }))
    expect(conflict.status).toBe(409)
    expect(conflict.body).toMatchObject({ error: { code: 'idempotency_key_in_use' } })
  })

  it('reports an in-progress key', async () => {
    const repo = new MemoryRepository()
    await repo.beginIdempotency({ merchantId: 'acct', key: 'busy', method: 'POST', path: '/v1/tokens', requestHash: 'h' })
    const claim = await repo.beginIdempotency({ merchantId: 'acct', key: 'busy', method: 'POST', path: '/v1/tokens', requestHash: 'h' })
    expect(claim).toMatchObject({ state: 'conflict', code: 'idempotency_key_in_progress' })
  })

  it('forgets a key when the handler throws', async () => {
    const repo = new MemoryRepository()
    const deps = { repo } as ServiceDeps
    await expect(runIdempotent(deps, 'acct', 'boom', 'POST', '/v1/tokens', '{}', async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    const retried = await runIdempotent(deps, 'acct', 'boom', 'POST', '/v1/tokens', '{}', async () => ok({ ok: true }))
    expect(retried.status).toBe(200)
  })

  it('forgets a key when the handler returns 500', async () => {
    const repo = new MemoryRepository()
    const deps = { repo } as ServiceDeps
    const failed = await runIdempotent(deps, 'acct', 'err', 'POST', '/v1/tokens', '{}', async () => ({ status: 500, body: { error: { code: 'internal_error' } } }))
    expect(failed.status).toBe(500)
    const retried = await runIdempotent(deps, 'acct', 'err', 'POST', '/v1/tokens', '{}', async () => ok({ retried: true }))
    expect(retried.body).toEqual({ retried: true })
  })

  it('runs immediately when no key is supplied', async () => {
    const repo = new MemoryRepository()
    const deps = { repo } as ServiceDeps
    const result = await runIdempotent(deps, 'acct', undefined, 'POST', '/v1/tokens', '{}', async () => ok({ fresh: true }))
    expect(result.body).toEqual({ fresh: true })
    await repo.close()
  })
})
