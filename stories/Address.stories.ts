import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref } from 'vue'
import { NexusElements, NexusAddressElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Address',
  decorators: [
    (story) => ({
      setup() {
        return () =>
          h(NexusElements, { publishableKey: 'pk_test_storybook' }, () => h('div', { style: 'max-width: 480px; padding: 24px;' }, [h(story)]))
      },
    }),
  ],
  parameters: {
    layout: 'padded',
  },
}

export default meta
type Story = StoryObj

export const Shipping: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAddressElement, { options: { mode: 'shipping' } })
    },
  }),
}

export const Billing: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAddressElement, { options: { mode: 'billing' } })
    },
  }),
}

export const WithPhone: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAddressElement, { options: { mode: 'shipping', phone: 'required' } })
    },
  }),
}

export const WithDefaults: Story = {
  render: () => ({
    setup() {
      const options = {
        mode: 'shipping',
        defaultValues: {
          name: '张三',
          address: { line1: '南京路 100 号', city: '上海', state: '上海', postalCode: '200000', country: 'CN' },
          phone: '+8613800138000',
        },
      }
      return () => h(NexusAddressElement, { options })
    },
  }),
}

export const WithChangeEvents: Story = {
  render: () => ({
    setup() {
      const log = ref<string[]>([])
      const onChange = (event: unknown) => {
        const e = event as Record<string, unknown>
        log.value = [...log.value.slice(-4), `complete=${e.complete} empty=${e.empty} valid=${e.valid}`]
      }
      return () =>
        h('div', [
          h(NexusAddressElement, { options: { mode: 'shipping' }, onChange }),
          h('pre', { style: 'margin-top: 16px; font-size: 12px; color: #666;' }, log.value.join('\n')),
        ])
    },
  }),
}
