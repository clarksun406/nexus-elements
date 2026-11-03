/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { NexusElement } from './element'
import type { IframeBridge } from './iframe/bridge'
import type { BridgeMessage } from './types/bridge'

type MockBridge = IframeBridge & { _trigger: (type: string, elementId: string, payload: unknown) => void }

function createMockBridge(): MockBridge {
  const handlers = new Map<string, Set<(msg: BridgeMessage) => void>>()
  return {
    on: vi.fn((type: string, elementId: string, handler: (msg: BridgeMessage) => void) => {
      const key = `${type}:${elementId}`
      if (!handlers.has(key)) handlers.set(key, new Set())
      handlers.get(key)!.add(handler)
    }),
    off: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined),
    sendAndWait: vi.fn().mockResolvedValue({}),
    attach: vi.fn(),
    detach: vi.fn(),
    _trigger(type: string, elementId: string, payload: unknown) {
      const key = `${type}:${elementId}`
      const msg = { payload } as BridgeMessage
      handlers.get(key)?.forEach((h) => h(msg))
    },
  } as unknown as MockBridge
}

function createElement(overrides: Partial<ConstructorParameters<typeof NexusElement>[0]> = {}) {
  const bridge = createMockBridge()
  const element = new NexusElement({
    id: 'el_1',
    type: 'card',
    options: {},
    bridge,
    publishableKey: 'pk_test_xxx',
    appearance: null,
    locale: 'en',
    ...overrides,
  })
  return { element, bridge }
}

describe('NexusElement', () => {
  describe('event system', () => {
    it('on() registers and fires handler', () => {
      const { element, bridge } = createElement()
      const handler = vi.fn()
      element.on('change', handler)
      bridge._trigger('nexus:change', 'el_1', { elementType: 'card', complete: true, empty: false, valid: true })
      expect(handler).toHaveBeenCalledOnce()
    })

    it('off() without handler clears all for that event', () => {
      const { element, bridge } = createElement()
      const h1 = vi.fn()
      const h2 = vi.fn()
      element.on('change', h1)
      element.on('change', h2)
      element.off('change')
      bridge._trigger('nexus:change', 'el_1', {})
      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
    })

    it('off() with handler removes only that handler', () => {
      const { element, bridge } = createElement()
      const h1 = vi.fn()
      const h2 = vi.fn()
      element.on('change', h1)
      element.on('change', h2)
      element.off('change', h1)
      bridge._trigger('nexus:change', 'el_1', {})
      expect(h1).not.toHaveBeenCalled()
      expect(h2).toHaveBeenCalledOnce()
    })

    it('forwards focus/blur/escape events', () => {
      const { element, bridge } = createElement()
      const focusH = vi.fn()
      const blurH = vi.fn()
      const escapeH = vi.fn()
      element.on('focus', focusH)
      element.on('blur', blurH)
      element.on('escape', escapeH)
      bridge._trigger('nexus:focus-event', 'el_1', {})
      bridge._trigger('nexus:blur-event', 'el_1', {})
      bridge._trigger('nexus:escape', 'el_1', {})
      expect(focusH).toHaveBeenCalledOnce()
      expect(blurH).toHaveBeenCalledOnce()
      expect(escapeH).toHaveBeenCalledOnce()
    })

    it('forwards confirm event with complete callback', () => {
      const { element, bridge } = createElement({ type: 'expressCheckout' })
      const handler = vi.fn()
      element.on('confirm', handler)
      bridge._trigger('nexus:confirm', 'el_1', { walletType: 'applePay' })
      expect(handler).toHaveBeenCalledOnce()
      const payload = handler.mock.calls[0]![0] as { walletType: string; complete: (s: string) => void }
      expect(payload.walletType).toBe('applePay')
      payload.complete('success')
      expect(bridge.send).toHaveBeenCalledWith('nexus:complete', 'el_1', { status: 'success' })
    })

    it('forwards cancel event', () => {
      const { element, bridge } = createElement()
      const handler = vi.fn()
      element.on('cancel', handler)
      bridge._trigger('nexus:cancel', 'el_1', {})
      expect(handler).toHaveBeenCalledOnce()
    })

    it('forwards ready event', () => {
      const { element, bridge } = createElement()
      const handler = vi.fn()
      element.on('ready', handler)
      bridge._trigger('nexus:ready', 'el_1', { elementType: 'card' })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler.mock.calls[0]![0]).toMatchObject({ elementType: 'card' })
    })
  })

  describe('lifecycle', () => {
    it('isMounted() returns false initially', () => {
      const { element } = createElement()
      expect(element.isMounted()).toBe(false)
    })

    it('mount() creates iframe and sets mounted', () => {
      const { element, bridge } = createElement()
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      expect(element.isMounted()).toBe(true)
      expect(bridge.attach).toHaveBeenCalledOnce()
      expect(container.querySelector('iframe')).toBeTruthy()
    })

    it('mount() with selector string', () => {
      const { element } = createElement()
      const container = document.createElement('div')
      container.id = 'test-mount'
      document.body.appendChild(container)
      element.mount('#test-mount')
      expect(element.isMounted()).toBe(true)
    })

    it('mount() throws if already mounted', () => {
      const { element } = createElement()
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      expect(() => element.mount(container)).toThrow('already mounted')
    })

    it('mount() throws if destroyed', () => {
      const { element } = createElement()
      element.destroy()
      expect(() => element.mount(document.createElement('div'))).toThrow('destroyed')
    })

    it('unmount() resets mounted state', () => {
      const { element, bridge } = createElement()
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      element.unmount()
      expect(element.isMounted()).toBe(false)
      expect(bridge.detach).toHaveBeenCalledOnce()
    })

    it('unmount() is no-op if not mounted', () => {
      const { element, bridge } = createElement()
      element.unmount()
      expect(bridge.detach).not.toHaveBeenCalled()
    })

    it('destroy() clears listeners and prevents reuse', () => {
      const { element, bridge } = createElement()
      const handler = vi.fn()
      element.on('change', handler)
      element.destroy()
      bridge._trigger('nexus:change', 'el_1', {})
      expect(handler).not.toHaveBeenCalled()
    })

    it('destroy() is idempotent', () => {
      const { element } = createElement()
      element.destroy()
      expect(() => element.destroy()).not.toThrow()
    })
  })

  describe('commands', () => {
    it('focus() sends nexus:focus', () => {
      const { element, bridge } = createElement()
      element.focus()
      expect(bridge.send).toHaveBeenCalledWith('nexus:focus', 'el_1', {})
    })

    it('blur() sends nexus:blur', () => {
      const { element, bridge } = createElement()
      element.blur()
      expect(bridge.send).toHaveBeenCalledWith('nexus:blur', 'el_1', {})
    })

    it('clear() sends nexus:clear', () => {
      const { element, bridge } = createElement()
      element.clear()
      expect(bridge.send).toHaveBeenCalledWith('nexus:clear', 'el_1', {})
    })

    it('collapse() and fetchUpdates() address the mounted frame', async () => {
      const { element, bridge } = createElement()
      element.collapse()
      await element.fetchUpdates()
      expect(bridge.send).not.toHaveBeenCalledWith('nexus:fetch-updates', 'el_1', {})
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      element.collapse()
      await element.fetchUpdates()
      expect(bridge.send).toHaveBeenCalledWith('nexus:collapse', 'el_1', {})
      expect(bridge.send).toHaveBeenCalledWith('nexus:fetch-updates', 'el_1', {})
    })

    it('emits loaderror for frame failures and error payloads', () => {
      const { element, bridge } = createElement()
      const handler = vi.fn()
      element.on('loaderror', handler)
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      container.querySelector('iframe')!.dispatchEvent(new Event('error'))
      bridge._trigger('nexus:error', 'el_1', { type: 'loaderror', message: 'nope' })
      expect(handler).toHaveBeenCalled()
    })

    it('update() merges options and sends nexus:update when mounted', async () => {
      const { element, bridge } = createElement()
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      await element.update({ disabled: true })
      expect(bridge.sendAndWait).toHaveBeenCalledWith(
        'nexus:update', 'el_1',
        expect.objectContaining({ options: expect.objectContaining({ disabled: true }) }),
        'nexus:ready',
      )
    })

    it('update() resolves immediately when not mounted', async () => {
      const { element, bridge } = createElement()
      await element.update({ disabled: true })
      expect(bridge.sendAndWait).not.toHaveBeenCalled()
    })

    it('setAppearance() sends nexus:appearance when mounted', () => {
      const { element, bridge } = createElement()
      const container = document.createElement('div')
      document.body.appendChild(container)
      element.mount(container)
      element.setAppearance({ theme: 'night' })
      expect(bridge.send).toHaveBeenCalledWith('nexus:appearance', 'el_1', expect.any(Object))
    })

    it('setAppearance() does not send when not mounted', () => {
      const { element, bridge } = createElement()
      element.setAppearance({ theme: 'night' })
      expect(bridge.send).not.toHaveBeenCalledWith('nexus:appearance', expect.anything(), expect.anything())
    })
  })

  describe('brand propagation', () => {
    it('propagates brand from cardNumber to cardCvc sibling', () => {
      const { element: cardNumber, bridge: bridge1 } = createElement({ id: 'el_num', type: 'cardNumber' })
      const { element: cardCvc, bridge: _bridge2 } = createElement({ id: 'el_cvc', type: 'cardCvc' })

      const container = document.createElement('div')
      document.body.appendChild(container)
      cardNumber.mount(container)
      cardCvc.mount(container)

      cardNumber.setGroupProvider(() => [cardNumber, cardCvc])

      bridge1._trigger('nexus:change', 'el_num', { elementType: 'cardNumber', brand: 'amex', complete: true, empty: false, valid: true })

      expect(bridge1.send).toHaveBeenCalledWith('nexus:brand', 'el_cvc', { brand: 'amex' })
    })
  })
})
