import { describe, expect, it } from 'vitest'
import { createMessage, randomSecret, redactSensitive, signMessage, timingSafeEqual, verifyMessage } from './channel'

describe('timingSafeEqual', () => {
  it('accepts equal strings and rejects different ones', () => {
    expect(timingSafeEqual('sig_aa', 'sig_aa')).toBe(true)
    expect(timingSafeEqual('sig_aa', 'sig_ab')).toBe(false)
    expect(timingSafeEqual('short', 'much-longer')).toBe(false)
  })
})

describe('channel messages', () => {
  it('signs the timestamp so it cannot be moved', async () => {
    const message = await createMessage('nexus:change', 'el', { ok: true }, 'channel-secret')
    expect(await verifyMessage(message, 'channel-secret')).toBe(true)
    expect(await verifyMessage({ ...message, timestamp: message.timestamp + 5 }, 'channel-secret')).toBe(false)
  })

  it('rejects a stale timestamp', async () => {
    const message = await createMessage('nexus:change', 'el', { ok: true }, 'channel-secret')
    expect(await verifyMessage(message, 'channel-secret', message.timestamp + 120_000)).toBe(false)
  })

  it('rejects a message without a signature', async () => {
    const message = await createMessage('nexus:change', 'el', {}, 'k')
    expect(await verifyMessage({ ...message, signature: '' }, 'k')).toBe(false)
  })

  it('does not use a short secret interchangeably', async () => {
    const message = await createMessage('nexus:init', 'el', { publishableKey: 'pk_test_x' }, randomSecret())
    expect(await verifyMessage(message, 'pk_test_x')).toBe(false)
    expect(await signMessage('body', 'pk_test_x')).toMatch(/^sig_/)
  })
})

describe('redactSensitive', () => {
  it('removes card and bank secrets at any depth', () => {
    expect(redactSensitive({
      brand: 'visa',
      number: '4242424242424242',
      value: { cvc: '123', postalCode: '10001', iban: 'DE89', account_number: '1' },
      list: [{ pan: '4111', ok: true }],
    })).toEqual({
      brand: 'visa',
      value: { postalCode: '10001' },
      list: [{ ok: true }],
    })
  })
})
