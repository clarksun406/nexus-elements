/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { createMessage } from '../../../core/src/iframe/channel'
import { FieldBridge } from './index'

const SECRET = '11'.repeat(32)

describe('FieldBridge', () => {
  it('locks the channel to the bootstrap secret and parent origin', async () => {
    const bridge = new FieldBridge()
    bridge.bootstrap({ elementId: 'el', channelSecret: SECRET, parentOrigin: 'https://merchant.test', groupId: 'g', groupKey: 'ab'.repeat(32) })
    bridge.bootstrap({ channelSecret: 'rotating-secret', parentOrigin: 'https://evil.test' })
    expect(bridge.getGroup()).toEqual({ groupId: 'g', groupKey: 'ab'.repeat(32) })

    const seen: string[] = []
    bridge.on('nexus:focus', (message) => seen.push(message.type))
    const message = await createMessage('nexus:focus', 'el', {}, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'https://evil.test', source: window.parent }))
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'https://merchant.test', source: window }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'https://merchant.test', source: window.parent }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'https://merchant.test', source: window.parent }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(seen).toEqual(['nexus:focus'])

    const posted: string[] = []
    const parent = { postMessage: (data: { type: string }, origin: string) => posted.push(`${data.type}:${origin}`) }
    viParent(parent)
    await bridge.send('nexus:ready', { elementType: 'card' })
    expect(posted[0]).toBe('nexus:ready:https://merchant.test')
    bridge.destroy()
  })

  it('ignores messages until a secret is installed', async () => {
    const bridge = new FieldBridge()
    const seen: string[] = []
    bridge.on('nexus:init', () => seen.push('init'))
    const message = await createMessage('nexus:init', 'el', { publishableKey: 'pk_test_x' }, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: window.location.origin, source: window.parent }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(seen).toEqual([])
    bridge.destroy()
  })
})

function viParent(parent: { postMessage: (data: { type: string }, origin: string) => void }) {
  Object.defineProperty(window, 'parent', { configurable: true, value: parent })
}
