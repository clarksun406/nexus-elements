import { isPublishableKey, isSecretKey, modeFromKey } from '@nexus-elements/contracts'
import type { ServerConfig } from '../config.js'

export interface AuthenticatedMerchant {
  merchantId: string
  accountId: string
  mode: 'test' | 'live'
  auth: 'publishable' | 'secret'
  clientSecret?: string
}

export type AuthResult =
  | { ok: true; merchant: AuthenticatedMerchant }
  | { ok: false; status: number; code: string; message: string }

export function authenticateHeaders(
  headers: Record<string, string | string[] | undefined>,
  config: ServerConfig,
): AuthResult {
  const authorization = headerValue(headers.authorization)
  const publishable = headerValue(headers['x-nexus-key'])
  const account = headerValue(headers['x-nexus-account'])
  const clientSecret = headerValue(headers['x-nexus-client-secret'])

  let auth: 'publishable' | 'secret' | null = null
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization)
    const token = match?.[1]
    if (!token || !isSecretKey(token) || token !== config.secretKey || modeFromKey(token) !== config.mode) {
      return { ok: false, status: 401, code: 'invalid_api_key', message: '无效的密钥。' }
    }
    auth = 'secret'
  } else if (publishable) {
    if (!isPublishableKey(publishable) || publishable !== config.publishableKey || modeFromKey(publishable) !== config.mode) {
      return { ok: false, status: 401, code: 'invalid_api_key', message: '无效的密钥。' }
    }
    auth = 'publishable'
  } else {
    return { ok: false, status: 401, code: 'invalid_api_key', message: '缺少 X-Nexus-Key 或 Authorization。' }
  }

  if (account && account !== config.accountId) {
    return { ok: false, status: 403, code: 'account_invalid', message: 'X-Nexus-Account 与密钥不匹配。' }
  }

  return {
    ok: true,
    merchant: {
      merchantId: config.accountId,
      accountId: config.accountId,
      mode: config.mode,
      auth,
      clientSecret,
    },
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
