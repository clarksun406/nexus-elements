/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { configureApi, protectTokenBody, requestToken } from './client'
import { publishTokenResult } from './token'
import { bridge } from '../bridge'

describe('token encryption', () => {
  it('leaves the card in place when the API has no key', async () => {
    configureApi({ apiBase: 'https://api.test', publishableKey: 'pk_test_x', nexusAccount: 'acct' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ algorithm: 'none' }) }))
    const body = await protectTokenBody({ card: { number: '4242' }, client_secret: 'cs' })
    expect(body.card).toEqual({ number: '4242' })
  })

  it('encrypts the card and posts only ciphertext', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    configureApi({ apiBase: '', publishableKey: 'pk_test_x' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ algorithm: 'RSA-OAEP', key_id: 'ek_1', public_key_jwk: jwk }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_enc', payment_method_id: 'pm_enc' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await requestToken({ card: { number: '4242424242424242', cvc: '123' }, client_secret: 'cs' })
    expect(result.data.token).toBe('tok_enc')
    const raw = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as { card?: unknown; encrypted_card?: { ciphertext: string } }
    expect(raw.card).toBeUndefined()
    expect(raw.encrypted_card?.ciphertext).toBeTruthy()
    expect(JSON.stringify(raw)).not.toContain('4242424242424242')
  })

  it('reports API and network tokenization failures', async () => {
    bridge.resetForTests()
    bridge.bootstrap({ elementId: 'el', channelSecret: 'aa'.repeat(32), parentOrigin: window.location.origin })
    const posted: Array<{ type?: string; payload?: { error?: { type?: string } } }> = []
    const original = window.parent.postMessage.bind(window.parent)
    window.parent.postMessage = ((data: { type?: string; payload?: { error?: { type?: string } } }) => {
      posted.push(data)
      original(data, window.location.origin)
    }) as typeof window.parent.postMessage
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { type: 'card_error', message: 'nope' } }) }))
    await publishTokenResult({ payment_method_type: 'ideal', ideal: { bank: 'ing' } })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await publishTokenResult({ payment_method_type: 'ideal' })
    expect(posted.map((entry) => entry.payload?.error?.type)).toEqual(['card_error', 'network_error'])
  })
})
