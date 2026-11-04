import { createHash } from 'node:crypto'
import type { ServiceDeps } from './deps.js'
import type { ApiResult } from './result.js'
import { fail } from './result.js'

export function hashRequest(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function runIdempotent(
  deps: ServiceDeps,
  merchantId: string,
  key: string | undefined,
  method: string,
  path: string,
  rawBody: string,
  fn: () => Promise<ApiResult>,
): Promise<ApiResult> {
  if (!key) return fn()
  const claim = await deps.repo.beginIdempotency({
    merchantId,
    key,
    method,
    path,
    requestHash: hashRequest(rawBody),
  })
  if (claim.state === 'replay') return { status: claim.status, body: claim.body }
  if (claim.state === 'conflict') return fail(409, 'api_error', claim.code, claim.message)
  try {
    const result = await fn()
    if (result.status >= 500) {
      await deps.repo.abortIdempotency(merchantId, key)
      return result
    }
    await deps.repo.finishIdempotency(merchantId, key, result.status, result.body)
    return result
  } catch (error) {
    await deps.repo.abortIdempotency(merchantId, key)
    throw error
  }
}
