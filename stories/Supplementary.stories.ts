import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import {
  NexusElements,
  NexusCartElement,
  NexusOrderElement,
  NexusAfterpayClearpayElement,
  NexusWalletButtonElement,
  NexusPaymentMethodMessagingElement,
  NexusLinkAuthenticationElement,
} from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Supplementary',
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

const CART_ITEMS = [
  { id: 'item_1', name: '经典白色 T 恤', description: '100% 纯棉', unit_amount: 12900, currency: 'CNY', quantity: 2 },
  { id: 'item_2', name: '牛仔裤', description: '修身款', unit_amount: 29900, currency: 'CNY', quantity: 1 },
]

export const Cart: Story = {
  render: () => ({
    setup() {
      return () => h(NexusCartElement, { options: { items: CART_ITEMS, allowPromoCodes: true } })
    },
  }),
}

export const CartEmpty: Story = {
  render: () => ({
    setup() {
      return () => h(NexusCartElement, { options: { items: [] } })
    },
  }),
}

export const OrderPaid: Story = {
  render: () => ({
    setup() {
      const options = {
        defaultValues: {
          status: 'paid',
          items: CART_ITEMS,
          paymentMethod: { type: 'card', card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 } },
          shippingAddress: { name: '张三', phone: '+8613800138000', address: { line1: '南京路 100 号', city: '上海', state: '上海', postalCode: '200000', country: 'CN' } },
          timeline: [
            { status: 'pending', timestamp: '2026-07-28T10:00:00Z', description: '订单已创建' },
            { status: 'paid', timestamp: '2026-07-28T10:05:00Z', description: '支付成功' },
          ],
        },
      }
      return () => h(NexusOrderElement, { options })
    },
  }),
}

export const OrderFailed: Story = {
  render: () => ({
    setup() {
      return () => h(NexusOrderElement, { options: { defaultValues: { status: 'failed' } } })
    },
  }),
}

export const AfterpayClearpay: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAfterpayClearpayElement, { options: { amount: 120.0, currency: 'USD' } })
    },
  }),
}

export const AfterpayClearpayGBP: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAfterpayClearpayElement, { options: { amount: 89.99, currency: 'GBP', locale: 'en-GB' } })
    },
  }),
}

export const AfterpayClearpayCompact: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAfterpayClearpayElement, { options: { amount: 49.99, currency: 'USD', style: 'compact' } })
    },
  }),
}

export const WalletButtonApplePay: Story = {
  render: () => ({
    setup() {
      return () => h(NexusWalletButtonElement, { options: { wallet: 'applePay' } })
    },
  }),
}

export const WalletButtonGooglePay: Story = {
  render: () => ({
    setup() {
      return () => h(NexusWalletButtonElement, { options: { wallet: 'googlePay' } })
    },
  }),
}

export const WalletButtonPayPal: Story = {
  render: () => ({
    setup() {
      return () => h(NexusWalletButtonElement, { options: { wallet: 'paypal', buttonTheme: 'gold' } })
    },
  }),
}

export const PaymentMethodMessaging: Story = {
  render: () => ({
    setup() {
      return () => h(NexusPaymentMethodMessagingElement, { options: { amount: 199.99, currency: 'USD' } })
    },
  }),
}

export const LinkAuthentication: Story = {
  render: () => ({
    setup() {
      return () => h(NexusLinkAuthenticationElement)
    },
  }),
}
