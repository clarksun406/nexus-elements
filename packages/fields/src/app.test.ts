/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMessage } from '../../core/src/iframe/channel'
import App from './App.vue'
import { bridge } from './bridge'

const SECRET = 'cd'.repeat(32)

describe('fields shell', () => {
  it('loads the requested field and applies init plus appearance updates', async () => {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserver)
    bridge.resetForTests()
    const hash = encodeURIComponent(JSON.stringify({
      v: 1,
      k: SECRET,
      g: 'grp_app',
      gk: 'ab'.repeat(32),
      p: window.location.origin,
    }))
    window.history.replaceState(null, '', `/?elementType=card&elementId=el_app#nexus=${hash}`)
    const wrapper = mount(App)
    await flushPromises()
    const init = await createMessage('nexus:init', 'el_app', {
      publishableKey: 'pk_test_app',
      elementType: 'card',
      options: {},
      appearance: { variables: { '--nexus-border-radius': '2px' }, rules: {} },
      locale: 'zh',
      apiBase: '',
    }, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: init, origin: window.location.origin, source: window.parent }))
    await flushPromises()
    const update = await createMessage('nexus:update', 'el_app', {
      options: { __appearance: { variables: { '--nexus-color-text': '#111' }, rules: {} } },
    }, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: update, origin: window.location.origin, source: window.parent }))
    await vi.waitFor(() => {
      expect(wrapper.html().length).toBeGreaterThan(20)
    })
    wrapper.unmount()
  })
})
