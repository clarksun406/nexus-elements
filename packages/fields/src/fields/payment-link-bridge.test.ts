/**
 * @vitest-environment jsdom
 */
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentField from './PaymentField.vue'
import { bridge } from '../bridge'
import { createMessage } from '../../../core/src/iframe/channel'

const SECRET = 'ef'.repeat(32)

vi.mock('../api/token', () => ({
  publishTokenResult: vi.fn().mockResolvedValue(undefined),
}))

describe('PaymentField Link row (bridge)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    bridge.resetForTests()
    bridge.bootstrap({
      elementId: 'el_link',
      channelSecret: SECRET,
      parentOrigin: window.location.origin,
      groupId: 'grp_test',
      groupKey: 'ab'.repeat(32),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    bridge.resetForTests()
  })

  async function bootWithLink() {
    const wrapper = mount(PaymentField)
    const message = await createMessage('nexus:init', 'el_link', {
      publishableKey: 'pk_test_fields',
      elementType: 'payment',
      options: { linkAuthentication: 'auto' },
      appearance: {},
      locale: 'en',
      apiBase: '',
    }, SECRET)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: message,
        origin: window.location.origin,
        source: window.parent,
      }),
    )
    await flushPromises()
    return wrapper
  }

  it('exposes a11y labels on the email field', async () => {
    const wrapper = await bootWithLink()
    await vi.waitFor(() => expect(wrapper.find('#nexus-link-email').exists()).toBe(true))
    const email = wrapper.get('#nexus-link-email')
    expect(email.attributes('aria-invalid')).toBe('false')
    expect(wrapper.find('label[for="nexus-link-email"]').exists()).toBe(true)
  })

  it('never includes OTP digits in change payloads', async () => {
    const payloads: unknown[] = []
    const wrapper = await bootWithLink()
    await vi.waitFor(() => expect(wrapper.find('#nexus-link-email').exists()).toBe(true))
    const send = vi.spyOn(bridge, 'send').mockImplementation((type, payload) => {
      if (type === 'nexus:change') payloads.push(payload)
    })
    await wrapper.get('#nexus-link-email').setValue('user@example.com')
    const sendBtn = wrapper.findAll('button').find((b) => b.text().includes('sandbox code'))
    await sendBtn!.trigger('click')
    vi.advanceTimersByTime(600)
    await flushPromises()
    const digits = wrapper.findAll('.nexus-payment-link-otp')
    for (let i = 0; i < 6; i++) {
      await digits.at(i)!.setValue(String(i + 1))
    }
    const verify = wrapper.findAll('button').find((b) => b.text().includes('Verify'))
    await verify!.trigger('click')
    vi.advanceTimersByTime(500)
    await flushPromises()
    const blob = JSON.stringify(payloads)
    expect(blob).not.toContain('123456')
    expect(blob).not.toMatch(/"1","2","3"/)
    send.mockRestore()
  })

  it('keeps linkVerified false after a wrong OTP', async () => {
    const payloads: Array<{ value?: Record<string, string> }> = []
    vi.spyOn(bridge, 'send').mockImplementation((type, payload) => {
      if (type === 'nexus:change') payloads.push(payload as { value?: Record<string, string> })
    })
    const wrapper = await bootWithLink()
    await vi.waitFor(() => expect(wrapper.find('#nexus-link-email').exists()).toBe(true))
    await wrapper.get('#nexus-link-email').setValue('user@example.com')
    await wrapper.findAll('button').find((b) => b.text().includes('sandbox code'))!.trigger('click')
    vi.advanceTimersByTime(600)
    await flushPromises()
    const digits = wrapper.findAll('.nexus-payment-link-otp')
    for (let i = 0; i < 6; i++) {
      await digits.at(i)!.setValue('9')
    }
    await wrapper.findAll('button').find((b) => b.text().includes('Verify'))!.trigger('click')
    vi.advanceTimersByTime(500)
    await flushPromises()
    expect(payloads.every((p) => p.value?.linkVerified !== 'true')).toBe(true)
  })
})