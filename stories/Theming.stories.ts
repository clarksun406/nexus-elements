import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref } from 'vue'
import { NexusElements, NexusCardElement, NexusPaymentElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Theming',
  parameters: {
    layout: 'padded',
  },
}

export default meta
type Story = StoryObj

function themedStory(appearance: Record<string, unknown>, component: 'card' | 'payment' = 'card') {
  return {
    setup() {
      const Comp = component === 'card' ? NexusCardElement : NexusPaymentElement
      return () =>
        h(NexusElements, { publishableKey: 'pk_test_storybook', options: { appearance } }, () =>
          h('div', { style: 'max-width: 520px; padding: 24px;' }, [h(Comp)]))
    },
  }
}

export const StripePreset: Story = {
  render: () => themedStory({ theme: 'stripe' }),
}

export const FlatPreset: Story = {
  render: () => themedStory({ theme: 'flat' }),
}

export const NightPreset: Story = {
  render: () => themedStory({ theme: 'night' }),
}

export const NonePreset: Story = {
  render: () => themedStory({ theme: 'none' }),
}

export const CustomVariables: Story = {
  render: () =>
    themedStory({
      variables: {
        colorPrimary: '#0570de',
        colorBackground: '#f0f7ff',
        colorText: '#1a1a2e',
        borderRadius: '12px',
        fontFamily: '"Inter", sans-serif',
      },
    }),
}

export const CustomRules: Story = {
  render: () =>
    themedStory({
      rules: {
        '.Input': {
          borderColor: '#e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
        '.Input:focus': {
          borderColor: '#3b82f6',
          boxShadow: '0 0 0 3px rgba(59,130,246,0.15)',
        },
      },
    }),
}

export const ThemeSwitcher: Story = {
  render: () => ({
    setup() {
      const theme = ref('stripe')
      const themes = ['stripe', 'flat', 'night', 'none']
      return () =>
        h('div', { style: 'max-width: 520px; padding: 24px;' }, [
          h('div', { style: 'display: flex; gap: 8px; margin-bottom: 16px;' },
            themes.map((t) =>
              h('button', {
                key: t,
                onClick: () => { theme.value = t },
                style: `padding: 6px 16px; border: 1px solid ${theme.value === t ? '#635bff' : '#ddd'}; border-radius: 6px; background: ${theme.value === t ? '#635bff' : '#fff'}; color: ${theme.value === t ? '#fff' : '#333'}; cursor: pointer; font-size: 13px;`,
              }, t),
            ),
          ),
          h(NexusElements, {
            publishableKey: 'pk_test_storybook',
            options: { appearance: { theme: theme.value } },
            key: theme.value,
          }, () => h(NexusPaymentElement)),
        ])
    },
  }),
}
