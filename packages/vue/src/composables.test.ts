/**
 * @vitest-environment jsdom
 */
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NexusElements from './components/NexusElementsProvider.vue'
import { useConfirm, useElements, useNexus } from './composables'

describe('vue adapter', () => {
  it('exposes confirm helpers inside the provider', () => {
    const Probe = defineComponent({
      setup() {
        const confirm = useConfirm()
        const elements = useElements()
        elements.create('card')
        return () => h('div', { class: 'probe' }, String(typeof confirm.confirmPayment))
      },
    })
    const wrapper = mount(NexusElements, {
      props: { publishableKey: 'pk_test_vue', options: { clientSecret: 'cs_test' } },
      slots: { default: () => h(Probe) },
    })
    expect(wrapper.text()).toContain('function')
    expect(wrapper.findComponent(Probe).exists()).toBe(true)
  })

  it('refuses to read context outside the provider', () => {
    const Lone = defineComponent({
      setup() {
        useNexus()
        return () => h('div')
      },
    })
    expect(() => mount(Lone)).toThrow(/NexusElements/)
  })
})
