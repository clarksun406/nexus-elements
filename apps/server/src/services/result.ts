export interface ApiResult {
  status: number
  body: unknown
}

export function ok(body: unknown, status = 200): ApiResult {
  return { status, body }
}

export function fail(status: number, type: string, code: string, message: string, extra?: Record<string, unknown>): ApiResult {
  return { status, body: { error: { type, code, message, ...extra } } }
}
