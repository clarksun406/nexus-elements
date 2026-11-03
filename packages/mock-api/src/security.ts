import type { ServerResponse } from 'node:http'

export type SecuritySurface = 'api' | 'frameable'

/**
 * API responses must not be framed (X-Frame-Options: DENY + frame-ancestors 'none').
 * Field and hosted-checkout documents are frameable only by NEXUS_FRAME_ANCESTORS.
 * X-Frame-Options cannot express an allowlist, so frameable documents rely on CSP
 * frame-ancestors. Set NEXUS_FRAME_ANCESTORS="'self'" to also emit SAMEORIGIN.
 */
export function applySecurityHeaders(res: ServerResponse, surface: SecuritySurface): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (surface === 'api') {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    return
  }
  const ancestors = process.env['NEXUS_FRAME_ANCESTORS'] ?? "'self' http://localhost:* http://127.0.0.1:*"
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors ${ancestors}; base-uri 'none'`,
  )
  if (ancestors.trim() === "'self'") {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  }
}

export function isCheckoutPath(url: string): boolean {
  return url === '/__nexus-checkout' || url === '/__nexus-checkout/' || url === '/__nexus-checkout/index.html'
}
