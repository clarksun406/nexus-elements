import type { IncomingMessage, ServerResponse } from 'node:http'

export { detectBrand, luhnValid } from '@nexus-elements/contracts'

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
