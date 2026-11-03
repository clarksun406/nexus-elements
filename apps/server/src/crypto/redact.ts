const SENSITIVE_KEYS = new Set([
  'number',
  'cvc',
  'cvv',
  'pan',
  'iban',
  'account_number',
  'ek',
  'ciphertext',
  'encrypted_card',
  'encrypted_key',
  'private_key',
  'private_key_pem',
  'authorization',
  'client_secret',
])

/** Deep-clone a log payload with PAN, CVC, and key material removed. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[max-depth]'
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1))
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      output[key] = '[redacted]'
      continue
    }
    output[key] = redact(entry, depth + 1)
  }
  return output
}
