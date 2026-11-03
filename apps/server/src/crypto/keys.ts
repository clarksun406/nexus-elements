import { constants, createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, type KeyObject } from 'node:crypto'

/**
 * PCI boundary: the RSA private key unwraps an AES-256-GCM session key.
 * The decrypted PAN exists only inside `decryptCard`'s return value.
 * Callers must classify and fingerprint it, then drop it. Do not log the
 * return value. Production deployments should inject the PEM from a KMS or
 * HSM via NEXUS_RSA_PRIVATE_KEY. Persisting the PEM in Postgres is a sandbox
 * convenience so encrypted payloads survive a process restart — it is not an
 * acceptable production key store.
 */
export class EncryptionKeys {
  readonly keyId: string
  private readonly privateKey: KeyObject
  private readonly publicJwk: JsonWebKey
  private readonly publicPem: string

  constructor(keyId: string, pem?: string) {
    this.keyId = keyId
    if (pem) {
      this.privateKey = createPrivateKey(pem)
    } else {
      this.privateKey = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 }).privateKey
    }
    const pub = createPublicKey(this.privateKey)
    this.publicPem = pub.export({ type: 'spki', format: 'pem' }).toString()
    const jwk = pub.export({ format: 'jwk' }) as JsonWebKey
    this.publicJwk = { ...jwk, alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] }
  }

  describe(nowSeconds: number): {
    key_id: string
    algorithm: 'RSA-OAEP'
    public_key_jwk: JsonWebKey
    public_key_pem: string
    expires_at: number
  } {
    return {
      key_id: this.keyId,
      algorithm: 'RSA-OAEP',
      public_key_jwk: this.publicJwk,
      public_key_pem: this.publicPem,
      expires_at: nowSeconds + 86_400,
    }
  }

  exportPrivatePem(): string {
    return this.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  }

  /**
   * SDK shape: AES-GCM ciphertext with the 16-byte tag appended, AES key
   * wrapped with RSA-OAEP SHA-256. `key_id` must match the active key.
   */
  decryptCard(encrypted: { key_id?: string; ek?: string; iv?: string; ciphertext?: string }): Record<string, unknown> | null {
    if (encrypted.key_id && encrypted.key_id !== this.keyId) return null
    if (!encrypted.ek || !encrypted.iv || !encrypted.ciphertext) return null
    try {
      const aesKey = privateDecrypt(
        { key: this.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(encrypted.ek, 'base64'),
      )
      const iv = Buffer.from(encrypted.iv, 'base64')
      const packed = Buffer.from(encrypted.ciphertext, 'base64')
      if (packed.length < 17) return null
      const tag = packed.subarray(packed.length - 16)
      const data = packed.subarray(0, packed.length - 16)
      const decipher = createDecipheriv('aes-256-gcm', aesKey, iv)
      decipher.setAuthTag(tag)
      const clear = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
      const parsed = JSON.parse(clear) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
}
