import { createHmac } from 'node:crypto'

/** One-way PAN correlator. The PAN itself is not stored. */
export function panFingerprint(secret: string, pan: string): string {
  return createHmac('sha256', secret).update(pan).digest('hex')
}
