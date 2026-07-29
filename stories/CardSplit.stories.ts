import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import {
  NexusElements,
  NexusCardNumberElement,
  NexusCardExpiryElement,
  NexusCardCvcElement,
} from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Card (Split)',
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

export const ThreeFields: Story = {
  render: () => ({
    setup() {
      return () =>
        h('div', { style: 'display: flex; flex-direction: column; gap: 16px;' }, [
          h('div', [
            h('label', { style: 'display: block; font-size: 13px; color: #666; margin-bottom: 4px;' }, 'Card number'),
            h(NexusCardNumberElement),
          ]),
          h('div', { style: 'display: flex; gap: 16px;' }, [
            h('div', { style: 'flex: 1;' }, [
              h('label', { style: 'display: block; font-size: 13px; color: #666; margin-bottom: 4px;' }, 'Expiry'),
              h(NexusCardExpiryElement),
            ]),
            h('div', { style: 'flex: 1;' }, [
              h('label', { style: 'display: block; font-size: 13px; color: #666; margin-bottom: 4px;' }, 'CVC'),
              h(NexusCardCvcElement),
            ]),
          ]),
        ])
    },
  }),
}

export const CustomPlaceholders: Story = {
  render: () => ({
    setup() {
      return () =>
        h('div', { style: 'display: flex; flex-direction: column; gap: 16px;' }, [
          h(NexusCardNumberElement, { options: { placeholder: '**** **** **** ****' } }),
          h('div', { style: 'display: flex; gap: 16px;' }, [
            h('div', { style: 'flex: 1;' }, [h(NexusCardExpiryElement, { options: { placeholder: 'MM/YY' } })]),
            h('div', { style: 'flex: 1;' }, [h(NexusCardCvcElement, { options: { placeholder: 'CVC' } })]),
          ]),
        ])
    },
  }),
}
