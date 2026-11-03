/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { collectCardParts, publishCardParts, resetGroupChannelForTests, startGroupChannel } from './group-channel'

function b64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

describe('group channel', () => {
  it('moves card parts between same-origin frames without a parent payload', async () => {
    resetGroupChannelForTests()
    const keyHex = 'ab'.repeat(32)
    startGroupChannel('grp_unit', keyHex)
    const raw = new Uint8Array(32)
    for (let i = 0; i < raw.length; i++) raw[i] = parseInt(keyHex.slice(i * 2, i * 2 + 2), 16)
    const aes = await crypto.subtle.importKey('raw', raw.buffer.slice(0), { name: 'AES-GCM' }, false, ['encrypt'])
    const peer = new BroadcastChannel('nexus-group:grp_unit')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(JSON.stringify({ exp_month: 12, exp_year: 2030, cvc: '123' }))
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, encoded))
    peer.postMessage({ role: 'cardExpiry', iv: b64(iv), ciphertext: b64(cipher) })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const parts = await collectCardParts('cardNumber', { number: '4242424242424242' }, 400)
    expect(parts.number).toBe('4242424242424242')
    expect(parts.exp_month).toBe(12)
    expect(parts.cvc).toBe('123')
    peer.close()
    resetGroupChannelForTests()
  })

  it('publishCardParts is a no-op without a channel', async () => {
    resetGroupChannelForTests()
    await publishCardParts('cardCvc', { cvc: '999' })
    const parts = await collectCardParts('cardCvc', { cvc: '999' }, 10)
    expect(parts).toEqual({ cvc: '999' })
  })
})
