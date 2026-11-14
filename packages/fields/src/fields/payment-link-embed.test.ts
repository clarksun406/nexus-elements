/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PaymentLinkEmbed from './PaymentLinkEmbed.vue'

describe('PaymentLinkEmbed', () => {
  it('rejects a wrong sandbox OTP', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PaymentLinkEmbed)
    await wrapper.get('#nexus-link-email').setValue('user@example.com')
    await wrapper.get('button').trigger('click')
    vi.advanceTimersByTime(600)
    await wrapper.vm.$nextTick()
    const digits = wrapper.findAll('.nexus-payment-link-otp')
    for (let i = 0; i < 6; i++) {
      await digits.at(i)!.setValue('0')
    }
    const verify = wrapper.findAll('button').find((btn) => btn.text().includes('Verify'))
    expect(verify).toBeDefined()
    await verify!.trigger('click')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').text()).toContain('123456')
    vi.useRealTimers()
  })

  it('marks verified after the sandbox code', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PaymentLinkEmbed)
    await wrapper.get('#nexus-link-email').setValue('link.demo@nexus.test')
    await wrapper.get('button').trigger('click')
    vi.advanceTimersByTime(600)
    await wrapper.vm.$nextTick()
    const digits = wrapper.findAll('.nexus-payment-link-otp')
    const code = '123456'
    for (let i = 0; i < 6; i++) {
      await digits.at(i)!.setValue(code[i]!)
    }
    const verify = wrapper.findAll('button').find((btn) => btn.text().includes('Verify'))
    expect(verify).toBeDefined()
    await verify!.trigger('click')
    vi.advanceTimersByTime(500)
    await wrapper.vm.$nextTick()
    const states = (wrapper.emitted('state') ?? []) as Array<[{ verified: boolean }]>
    expect(states.some((entry) => entry[0].verified)).toBe(true)
    expect(wrapper.find('.nexus-link-verified').exists()).toBe(true)
    vi.useRealTimers()
  })
})