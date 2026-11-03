import { createDecipheriv, generateKeyPairSync, privateDecrypt, constants, type KeyObject } from 'node:crypto'

let publicJwk: JsonWebKey | null = null
let privateKey: KeyObject | null = null
const KEY_ID = 'ek_test_rsa_oaep'

export function getEncryptionKey(): { key_id: string; algorithm: 'RSA-OAEP'; public_key_jwk: JsonWebKey; expires_at: number } {
  if (!publicJwk || !privateKey) {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 })
    privateKey = pair.privateKey
    const jwk = pair.publicKey.export({ format: 'jwk' }) as JsonWebKey
    publicJwk = { ...jwk, alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] }
  }
  return {
    key_id: KEY_ID,
    algorithm: 'RSA-OAEP',
    public_key_jwk: publicJwk,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
  }
}

export function decryptCard(encrypted: { ek?: string; iv?: string; ciphertext?: string }): Record<string, unknown> | null {
  if (!privateKey || !encrypted.ek || !encrypted.iv || !encrypted.ciphertext) return null
  try {
    const aesKey = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(encrypted.ek, 'base64'),
    )
    const iv = Buffer.from(encrypted.iv, 'base64')
    const packed = Buffer.from(encrypted.ciphertext, 'base64')
    const tag = packed.subarray(packed.length - 16)
    const data = packed.subarray(0, packed.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', aesKey, iv)
    decipher.setAuthTag(tag)
    const clear = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    return JSON.parse(clear) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Test helper so a fresh key is minted. */
export function resetEncryptionKey(): void {
  publicJwk = null
  privateKey = null
}
