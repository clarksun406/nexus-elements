import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref } from 'vue'
import { NexusElements, NexusPaymentElement } from '@nexus-elements/vue'

const meta: Meta = {
  title: 'Elements/Payment',
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
      return () => h(NexusPaymentElement)
    },
  }),
}

export const TabsLayout: Story = {
  render: () => ({
    setup() {
      return () => h(NexusPaymentElement, { options: { layout: 'tabs' } })
    },
  }),
}

export const AccordionLayout: Story = {
  render: () => ({
    setup() {
      return () => h(NexusPaymentElement, { options: { layout: 'accordion' } })
    },
  }),
}

export const RadioLayout: Story = {
  render: () => ({
    setup() {
      return () => h(NexusPaymentElement, { options: { layout: 'radio' } })
    },
  }),
}

export const WithSavedMethods: Story = {
  render: () => ({
    setup() {
      const options = {
        savedPaymentMethods: [
          { id: 'pm_test_visa', type: 'card', card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 } },
          { id: 'pm_test_mc', type: 'card', card: { brand: 'mastercard', last4: '5555', expMonth: 6, expYear: 2027 } },
        ],
      }
      return () => h(NexusPaymentElement, { options })
    },
  }),
}

export const CardOnly: Story = {
  render: () => ({
    setup() {
      return () => h(NexusPaymentElement, { options: { paymentMethods: { card: 'always', ideal: 'never' } } })
    },
  }),
}

export const WithBilling: Story = {
  render: () => ({
    setup() {
      const options = {
        billingDetails: {
          name: 'required',
          email: 'required',
          phone: 'optional',
          address: { line1: 'required', city: 'required', state: 'required', postalCode: 'required', country: 'required' },
        },
      }
      return () => h(NexusPaymentElement, { options })
    },
  }),
}

export const WithChangeEvents: Story = {
  render: () => ({
    setup() {
      const log = ref<string[]>([])
      const onChange = (event: unknown) => {
        const e = event as Record<string, unknown>
        log.value = [...log.value.slice(-4), `type=${e.paymentMethodType ?? '-'} complete=${e.complete} valid=${e.valid}`]
      }
      return () =>
        h('div', [
          h(NexusPaymentElement, { onChange }),
          h('pre', { style: 'margin-top: 16px; font-size: 12px; color: #666;' }, log.value.join('\n')),
        ])
    },
  }),
}
