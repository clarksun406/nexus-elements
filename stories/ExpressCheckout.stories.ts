import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { NexusElements, NexusExpressCheckoutElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Express Checkout',
  decorators: [
    (story) => ({
      setup() {
        return () =>
          h(NexusElements, { publishableKey: 'pk_test_storybook' }, () => h('div', { style: 'max-width: 520px; padding: 24px;' }, [h(story)]))
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
      return () => h(NexusExpressCheckoutElement)
    },
  }),
}

export const BlackTheme: Story = {
  render: () => ({
    setup() {
      const options = {
        buttonTheme: { applePay: 'black', googlePay: 'black', paypal: 'black' },
      }
      return () => h(NexusExpressCheckoutElement, { options })
    },
  }),
}

export const BuyType: Story = {
  render: () => ({
    setup() {
      const options = {
        buttonType: { applePay: 'buy', googlePay: 'buy', paypal: 'buy' },
      }
      return () => h(NexusExpressCheckoutElement, { options })
    },
  }),
}

export const TallButtons: Story = {
  render: () => ({
    setup() {
      return () => h(NexusExpressCheckoutElement, { options: { buttonHeight: 56 } })
    },
  }),
}

export const PayPalOnly: Story = {
  render: () => ({
    setup() {
      const options = {
        paymentMethods: { applePay: 'never', googlePay: 'never', paypal: 'always', link: 'never' },
      }
      return () => h(NexusExpressCheckoutElement, { options })
    },
  }),
}
