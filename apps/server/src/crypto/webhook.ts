import { createHmac, timingSafeEqual } from 'node:crypto'

export function signWebhook(secret: string, payload: string, timestamp: number): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${digest}`
}

export function verifyWebhook(secret: string, header: string, payload: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  const parts = new Map<string, string>()
  for (const piece of header.split(',')) {
    const [key, value] = piece.split('=')
    if (key && value) parts.set(key.trim(), value.trim())
  }
  const timestamp = Number(parts.get('t'))
  const signature = parts.get('v1')
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
