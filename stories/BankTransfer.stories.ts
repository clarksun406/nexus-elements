import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import {
  NexusElements,
  NexusIdealBankElement,
  NexusFpxBankElement,
  NexusEpsBankElement,
  NexusP24BankElement,
  NexusIbanElement,
  NexusAuBankAccountElement,
} from '@nexus-elements/vue'

const bankDecorator = (story: () => unknown) => ({
  setup() {
    return () =>
      h(NexusElements, { publishableKey: 'pk_test_storybook' }, () => h('div', { style: 'max-width: 480px; padding: 24px;' }, [h(story)]))
  },
})

const meta: Meta = {
  title: 'Elements/Bank Transfer',
  decorators: [bankDecorator],
  parameters: {
    layout: 'padded',
  },
}

export default meta
type Story = StoryObj

export const IdealBank: Story = {
  render: () => ({
    setup() {
      return () => h(NexusIdealBankElement)
    },
  }),
}

export const FpxBank: Story = {
  render: () => ({
    setup() {
      return () => h(NexusFpxBankElement)
    },
  }),
}

export const EpsBank: Story = {
  render: () => ({
    setup() {
      return () => h(NexusEpsBankElement)
    },
  }),
}

export const P24Bank: Story = {
  render: () => ({
    setup() {
      return () => h(NexusP24BankElement)
    },
  }),
}

export const Iban: Story = {
  render: () => ({
    setup() {
      return () => h(NexusIbanElement)
    },
  }),
}

export const IbanWithCountryFilter: Story = {
  render: () => ({
    setup() {
      return () => h(NexusIbanElement, { options: { supportedCountries: ['DE', 'FR', 'NL', 'BE'] } })
    },
  }),
}

export const AuBankAccount: Story = {
  render: () => ({
    setup() {
      return () => h(NexusAuBankAccountElement)
    },
  }),
}
