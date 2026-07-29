import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { NexusElements, NexusCardElement, NexusCardNumberElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Element Styles',
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

export const CustomBaseStyle: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            color: '#30313d',
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: '16px',
            borderRadius: '8px',
            border: '2px solid #e0e0e0',
            padding: '12px',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const FocusHighlight: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            transition: 'all 0.2s ease',
          },
          focus: {
            border: '2px solid #635bff',
            boxShadow: '0 0 0 3px rgba(99, 91, 255, 0.15)',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const InvalidState: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            color: '#30313d',
            border: '1px solid #e0e0e0',
          },
          invalid: {
            color: '#df1b41',
            border: '1px solid #df1b41',
            backgroundColor: '#fff5f5',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const CompleteState: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            border: '1px solid #e0e0e0',
          },
          complete: {
            border: '1px solid #30b130',
            backgroundColor: '#f0fff0',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const DisabledStyle: Story = {
  render: () => ({
    setup() {
      const options = {
        disabled: true,
        style: {
          base: {
            border: '1px solid #e0e0e0',
          },
          disabled: {
            backgroundColor: '#f6f9fc',
            color: '#aab7c4',
            cursor: 'not-allowed',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const FullStateSet: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            fontFamily: '"Inter", sans-serif',
            fontSize: '15px',
            color: '#1a1a2e',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '10px 14px',
          },
          empty: {
            color: '#9ca3af',
          },
          focus: {
            border: '2px solid #3b82f6',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
          },
          complete: {
            border: '1px solid #10b981',
          },
          invalid: {
            border: '1px solid #ef4444',
            backgroundColor: '#fef2f2',
          },
          disabled: {
            backgroundColor: '#f3f4f6',
            color: '#9ca3af',
          },
        },
      }
      return () => h(NexusCardElement, { options })
    },
  }),
}

export const SplitCardStyles: Story = {
  render: () => ({
    setup() {
      const options = {
        style: {
          base: {
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 12px',
          },
          focus: {
            border: '2px solid #8b5cf6',
            boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.1)',
          },
        },
      }
      return () =>
        h('div', { style: 'display: flex; flex-direction: column; gap: 16px;' }, [
          h('div', [
            h('label', { style: 'display: block; font-size: 13px; color: #666; margin-bottom: 4px;' }, 'Card number'),
            h(NexusCardNumberElement, { options }),
          ]),
        ])
    },
  }),
}
