/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { createMessage } from './channel'
import { IframeBridge } from './bridge'

const SECRET = 'ab'.repeat(32)

function frame(origin = 'https://fields.test') {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  const bridge = new IframeBridge('pk_test_should_not_be_the_key', {
    secret: SECRET,
    groupId: 'grp_test',
    groupKey: 'cd'.repeat(32),
  })
  bridge.attach('el_1', iframe, origin)
  return { iframe, bridge, source: iframe.contentWindow }
}

async function deliver(data: unknown, origin: string, source: MessageEventSource | null) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('IframeBridge', () => {
  it('does not adopt the publishable key as the channel secret', () => {
    const bridge = new IframeBridge('pk_test_public')
    expect(bridge.getBootstrap().secret).not.toBe('pk_test_public')
    expect(bridge.getBootstrap().secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('accepts a signed message from the frame origin and source', async () => {
    const { bridge, source } = frame()
    const seen: unknown[] = []
    bridge.on('nexus:change', 'el_1', (message) => seen.push(message.payload))
    const message = await createMessage('nexus:change', 'el_1', { complete: true, number: '4242424242424242' }, SECRET)
    await deliver(message, 'https://fields.test', source)
    expect(seen).toEqual([{ complete: true }])
  })

  it('drops cross-origin, wrong-source, forged, and replayed messages', async () => {
    const { bridge, source } = frame()
    const seen: string[] = []
    bridge.on('nexus:ready', 'el_1', () => seen.push('ok'))
    const message = await createMessage('nexus:ready', 'el_1', { elementType: 'card' }, SECRET)

    await deliver(message, 'https://evil.test', source)
    await deliver(message, 'https://fields.test', window)
    await deliver({ ...message, signature: `sig_${'0'.repeat(64)}` }, 'https://fields.test', source)
    await deliver(message, 'https://fields.test', source)
    await deliver(message, 'https://fields.test', source)
    expect(seen).toEqual(['ok'])
  })

  it('send posts to the explicit fields origin', async () => {
    const { iframe, bridge } = frame()
    const posted: unknown[] = []
    const contentWindow = iframe.contentWindow
    if (!contentWindow) throw new Error('iframe has no contentWindow')
    contentWindow.postMessage = ((data: unknown, origin: string) => {
      posted.push({ data, origin })
    }) as typeof contentWindow.postMessage
    await bridge.send('nexus:focus', 'el_1', { ok: true })
    expect(posted).toHaveLength(1)
    expect((posted[0] as { origin: string }).origin).toBe('https://fields.test')
    expect((posted[0] as { data: { signature: string } }).data.signature).toMatch(/^sig_/)
  })

  it('sendAndWait resolves the matching response and rejects on timeout', async () => {
    const { bridge, source } = frame()
    const pending = bridge.sendAndWait('nexus:tokenize', 'el_1', { clientSecret: 'cs' }, 'nexus:token-result', 1000)
    const message = await createMessage('nexus:token-result', 'el_1', { token: 'tok_1' }, SECRET)
    await deliver(message, 'https://fields.test', source)
    await expect(pending).resolves.toEqual({ token: 'tok_1' })

    const timed = bridge.sendAndWait('nexus:focus', 'el_1', {}, 'nexus:blur-event', 15)
    await expect(timed).rejects.toThrow(/timeout/)
  })

  it('detaches listeners when the last frame is removed', () => {
    const { iframe, bridge } = frame()
    const handler = vi.fn()
    bridge.on('nexus:change', 'el_1', handler)
    bridge.onAny(handler)
    bridge.detach('el_1')
    window.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'nexus:change' } }))
    expect(handler).not.toHaveBeenCalled()
    iframe.remove()
  })
})
