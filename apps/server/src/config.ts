import { isPublishableKey, isSecretKey, modeFromKey, type KeyMode } from '@nexus-elements/contracts'

const DEFAULT_PUBLISHABLE_KEY = 'pk_test_nexus_example_key'
const DEFAULT_SECRET_KEY = 'sk_test_nexus_example_secret'

export interface ServerConfig {
  publishableKey: string
  secretKey: string
  accountId: string
  webhookSecret: string
  webhookUrl?: string
  mode: KeyMode
  corsOrigins: string[]
  rateLimitMax: number
  tokenRateLimitMax: number
  rateLimitWindowMs: number
  allowPublishableCreates: boolean
  databaseUrl?: string
  store: 'memory' | 'postgres'
  logLevel: string
  port: number
  host: string
  encryptionKeyId: string
  rsaPrivateKeyPem?: string
  publicBaseUrl: string
  frameAncestors: string
  nodeEnv: string
}

export interface LoadConfigOptions {
  env?: NodeJS.ProcessEnv
  /** When true, missing production secrets throw. Tests pass false. */
  enforceProduction?: boolean
}

function integerEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

export function loadConfig(options: LoadConfigOptions = {}): ServerConfig {
  const env = options.env ?? process.env
  const nodeEnv = env.NODE_ENV ?? 'development'
  const publishableKey = env.NEXUS_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY
  const secretKey = env.NEXUS_SECRET_KEY || DEFAULT_SECRET_KEY
  const mode = modeFromKey(publishableKey)
  if (!mode || !isPublishableKey(publishableKey)) {
    throw new Error('NEXUS_PUBLISHABLE_KEY must start with pk_test_ or pk_live_')
  }
  if (!isSecretKey(secretKey) || modeFromKey(secretKey) !== mode) {
    throw new Error('NEXUS_SECRET_KEY must be an sk_ key in the same mode as the publishable key')
  }
  if (options.enforceProduction !== false && nodeEnv === 'production') {
    if (!env.NEXUS_PUBLISHABLE_KEY || !env.NEXUS_SECRET_KEY || !env.NEXUS_WEBHOOK_SECRET) {
      throw new Error('NEXUS_PUBLISHABLE_KEY, NEXUS_SECRET_KEY, and NEXUS_WEBHOOK_SECRET are required in production')
    }
    if (secretKey === DEFAULT_SECRET_KEY) {
      throw new Error('Refusing the sample secret key when NODE_ENV=production')
    }
  }
  const databaseUrl = env.DATABASE_URL || undefined
  const storeEnv = env.STORE
  const store: 'memory' | 'postgres' = storeEnv === 'postgres' || (!storeEnv && databaseUrl) ? 'postgres' : 'memory'
  if (store === 'postgres' && !databaseUrl) {
    throw new Error('DATABASE_URL is required when STORE=postgres')
  }
  const origins = (env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return {
    publishableKey,
    secretKey,
    accountId: env.NEXUS_ACCOUNT_ID || 'acct_test_default',
    webhookSecret: env.NEXUS_WEBHOOK_SECRET || 'whsec_test_nexus_example',
    webhookUrl: env.NEXUS_WEBHOOK_URL || undefined,
    mode,
    corsOrigins: origins,
    rateLimitMax: integerEnv(env, 'RATE_LIMIT_MAX', 600),
    tokenRateLimitMax: integerEnv(env, 'TOKEN_RATE_LIMIT_MAX', 60),
    rateLimitWindowMs: integerEnv(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    allowPublishableCreates: (env.ALLOW_PUBLISHABLE_CREATES ?? 'true') !== 'false',
    databaseUrl,
    store,
    logLevel: env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
    port: integerEnv(env, 'PORT', 3001),
    host: env.HOST || '0.0.0.0',
    encryptionKeyId: env.NEXUS_ENCRYPTION_KEY_ID || 'ek_test_rsa_oaep',
    rsaPrivateKeyPem: env.NEXUS_RSA_PRIVATE_KEY || undefined,
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
    frameAncestors: env.NEXUS_FRAME_ANCESTORS || "'self' http://localhost:* http://127.0.0.1:*",
    nodeEnv,
  }
}
