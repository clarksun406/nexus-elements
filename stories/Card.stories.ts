import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref } from 'vue'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Card',
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

export const Default: Story = {
  render: () => ({
    setup() {
      return () => h(NexusCardElement)
    },
  }),
}

export const WithPlaceholder: Story = {
  render: () => ({
    setup() {
      const options = {
        placeholders: {
          cardNumber: '1234 5678 9012 3456',
          expiry: 'MM/YY',
          cvc: '123',
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const Disabled: Story = {
  render: () => ({
    setup() {
      return () => h(NexusCardElement, { options: { disabled: true } })
    },
  }),
}

export const IconHidden: Story = {
  render: () => ({
    setup() {
      return () => h(NexusCardElement, { options: { showIcon: false } })
    },
  }),
}

export const WithChangeEvents: Story = {
  render: () => ({
    setup() {
      const log = ref<string[]>([])
      const onChange = (event: unknown) => {
        const e = event as Record<string, unknown>
        log.value = [...log.value.slice(-4), `complete=${e.complete} empty=${e.empty} valid=${e.valid} brand=${e.brand ?? '-'}`]
      }
      return () =>
        h('div', [
          h(NexusCardElement, { onChange }),
          h('pre', { style: 'margin-top: 16px; font-size: 12px; color: #666;' }, log.value.join('\n')),
        ])
    },
  }),
}
