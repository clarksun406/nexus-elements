import { describe, expect, it } from 'vitest'
import { createMessage, signMessage, verifyMessage } from './bridge'

describe('signMessage', () => {
  it('is deterministic for the same input', async () => {
    expect(await signMessage('payload-a', 'pk_test_key')).toBe(await signMessage('payload-a', 'pk_test_key'))
  })

  it('differs across keys', async () => {
    expect(await signMessage('payload-a', 'pk_test_one')).not.toBe(await signMessage('payload-a', 'pk_test_two'))
  })

  it('differs across payloads', async () => {
    expect(await signMessage('payload-a', 'pk_test_key')).not.toBe(await signMessage('payload-b', 'pk_test_key'))
  })

  it('produces a sig_-prefixed 64-char hex digest (HMAC-SHA256)', async () => {
    expect(await signMessage('x', 'k')).toMatch(/^sig_[0-9a-f]{64}$/)
  })
})

describe('createMessage / verifyMessage', () => {
  it('round-trips a message', async () => {
    const message = await createMessage('nexus:change', 'nexus_el_1', { complete: true }, 'pk_test_key')
    expect(await verifyMessage(message, 'pk_test_key')).toBe(true)
  })

  it('fills envelope fields', async () => {
    const message = await createMessage('nexus:ready', 'nexus_el_2', { elementType: 'card' }, 'pk_test_key')
    expect(message.version).toBe(1)
    expect(message.type).toBe('nexus:ready')
    expect(message.elementId).toBe('nexus_el_2')
    expect(message.id).toMatch(/^msg_/)
    expect(typeof message.timestamp).toBe('number')
  })

  it('rejects a tampered payload', async () => {
    const message = await createMessage('nexus:token-result', 'nexus_el_1', { token: 'tok_1' }, 'pk_test_key')
    const tampered = { ...message, payload: { token: 'tok_stolen' } }
    expect(await verifyMessage(tampered, 'pk_test_key')).toBe(false)
  })

  it('rejects a tampered elementId', async () => {
    const message = await createMessage('nexus:change', 'nexus_el_1', { complete: true }, 'pk_test_key')
    const tampered = { ...message, elementId: 'nexus_el_999' }
    expect(await verifyMessage(tampered, 'pk_test_key')).toBe(false)
  })

  it('rejects a wrong signing key', async () => {
    const message = await createMessage('nexus:change', 'nexus_el_1', { complete: true }, 'pk_test_key')
    expect(await verifyMessage(message, 'pk_test_other_merchant')).toBe(false)
  })

  it('rejects a forged signature', async () => {
    const message = await createMessage('nexus:change', 'nexus_el_1', { complete: true }, 'pk_test_key')
    const forged = { ...message, signature: `sig_${'0'.repeat(64)}` }
    expect(await verifyMessage(forged, 'pk_test_key')).toBe(false)
  })
})
