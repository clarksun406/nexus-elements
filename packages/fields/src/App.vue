<script setup lang="ts">
import { shallowRef, onMounted } from 'vue'
import { bridge } from './bridge'
import { applyAppearance } from './appearance'
import { setLocale } from './i18n'
import type { InitPayload, ResolvedAppearancePayload } from './bridge/types'
import CardField from './fields/CardField.vue'
import CardNumberField from './fields/CardNumberField.vue'
import CardExpiryField from './fields/CardExpiryField.vue'
import CardCvcField from './fields/CardCvcField.vue'
import PaymentField from './fields/PaymentField.vue'
import ExpressCheckoutField from './fields/ExpressCheckoutField.vue'
import AddressField from './fields/AddressField.vue'
import IdealBankField from './fields/IdealBankField.vue'
import FpxBankField from './fields/FpxBankField.vue'
import EpsBankField from './fields/EpsBankField.vue'
import P24BankField from './fields/P24BankField.vue'
import IbanField from './fields/IbanField.vue'
import AuBankAccountField from './fields/AuBankAccountField.vue'
import PaymentMessagingField from './fields/PaymentMessagingField.vue'
import LinkAuthenticationField from './fields/LinkAuthenticationField.vue'
import CartField from './fields/CartField.vue'
import OrderField from './fields/OrderField.vue'
import AfterpayClearpayField from './fields/AfterpayClearpayField.vue'
import WalletButtonField from './fields/WalletButtonField.vue'

const FIELD_COMPONENTS: Record<string, typeof CardField> = {
  card: CardField,
  cardNumber: CardNumberField,
  cardExpiry: CardExpiryField,
  cardCvc: CardCvcField,
  payment: PaymentField,
  expressCheckout: ExpressCheckoutField,
  address: AddressField as unknown as typeof CardField,
  idealBank: IdealBankField as unknown as typeof CardField,
  fpxBank: FpxBankField as unknown as typeof CardField,
  epsBank: EpsBankField as unknown as typeof CardField,
  p24Bank: P24BankField as unknown as typeof CardField,
  iban: IbanField as unknown as typeof CardField,
  auBankAccount: AuBankAccountField as unknown as typeof CardField,
  paymentMethodMessaging: PaymentMessagingField as unknown as typeof CardField,
  linkAuthentication: LinkAuthenticationField as unknown as typeof CardField,
  cart: CartField as unknown as typeof CardField,
  order: OrderField as unknown as typeof CardField,
  afterpayClearpay: AfterpayClearpayField as unknown as typeof CardField,
  walletButton: WalletButtonField as unknown as typeof CardField,
}

const params = new URLSearchParams(window.location.search)
const elementType = params.get('elementType') ?? 'card'
const activeField = shallowRef(FIELD_COMPONENTS[elementType] ?? CardField)

bridge.init()

bridge.on('nexus:init', (message) => {
  const payload = message.payload as InitPayload
  setLocale(payload.locale)
  applyAppearance(payload.appearance)
})

bridge.on('nexus:appearance', (message) => {
  applyAppearance(message.payload as ResolvedAppearancePayload)
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options?: Record<string, unknown> }
  const newType = payload.options?.__elementType as string | undefined
  if (newType && FIELD_COMPONENTS[newType]) {
    activeField.value = FIELD_COMPONENTS[newType]
  }
})

onMounted(() => {
  let lastHeight = 0
  const observer = new ResizeObserver(() => {
    const height = document.documentElement.scrollHeight
    if (height !== lastHeight && height > 0) {
      lastHeight = height
      bridge.send('nexus:resize', { height })
    }
  })
  observer.observe(document.body)
})
</script>

<template>
  <component :is="activeField" />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  overflow: hidden;
  background: transparent;
}
</style>
