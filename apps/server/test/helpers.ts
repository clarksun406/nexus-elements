import type { FastifyInstance } from 'fastify'
import { loadConfig, type ServerConfig } from '../src/config.js'
import { buildApp } from '../src/app.js'

export const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'
export const SECRET_KEY = 'sk_test_nexus_example_secret'

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const base = loadConfig({
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      STORE: 'memory',
      RATE_LIMIT_MAX: '10000',
      TOKEN_RATE_LIMIT_MAX: '10000',
      NEXUS_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
      NEXUS_SECRET_KEY: SECRET_KEY,
      NEXUS_WEBHOOK_SECRET: 'whsec_test_nexus_example',
      CORS_ORIGINS: 'http://localhost:3000',
    },
    enforceProduction: false,
  })
  return { ...base, ...overrides }
}

export class ManualClock {
  value = Date.now()
  now(): number {
    return this.value
  }
  advance(ms: number): void {
    this.value += ms
  }
}

export async function startApp(overrides: Partial<ServerConfig> = {}, clock?: ManualClock): Promise<{ app: FastifyInstance; base: string }> {
  const app = await buildApp(testConfig(overrides), clock ? { clock } : {})
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error('no port')
  return { app, base: `http://127.0.0.1:${address.port}` }
}
