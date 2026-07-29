import type { IncomingMessage, ServerResponse } from 'node:http'

export function detectBrand(number: string): string {
  if (number.startsWith('4')) return 'visa'
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard'
  if (/^3[47]/.test(number)) return 'amex'
  if (/^62/.test(number)) return 'unionpay'
  if (/^35/.test(number)) return 'jcb'
  return 'unknown'
}

export function luhnValid(number: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = number.length - 1; i >= 0; i--) {
    let n = number.charCodeAt(i) - 48
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        resolvePromise(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export function json(res: ServerResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(data))
}

export function errorResponse(res: ServerResponse, status: number, type: string, code: string, message: string, extra?: Record<string, unknown>): void {
  json(res, status, { error: { type, code, message, ...extra } })
}
