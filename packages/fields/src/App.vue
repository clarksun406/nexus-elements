<script setup lang="ts">
import { shallowRef, onMounted, type Component } from 'vue'
import { bridge } from './bridge'
import { applyAppearance, applyFonts } from './appearance'
import { ensureLocale, t } from './i18n'
import { configureApi } from './api/client'
import { startGroupChannel } from './secure/group-channel'
import type { InitPayload, ResolvedAppearancePayload } from './bridge/types'

const FIELD_LOADERS: Record<string, () => Promise<{ default: Component }>> = {
  card: () => import('./fields/CardField.vue'),
  cardNumber: () => import('./fields/CardNumberField.vue'),
  cardExpiry: () => import('./fields/CardExpiryField.vue'),
  cardCvc: () => import('./fields/CardCvcField.vue'),
  payment: () => import('./fields/PaymentField.vue'),
  expressCheckout: () => import('./fields/ExpressCheckoutField.vue'),
  address: () => import('./fields/AddressField.vue'),
  idealBank: () => import('./fields/IdealBankField.vue'),
  fpxBank: () => import('./fields/FpxBankField.vue'),
  epsBank: () => import('./fields/EpsBankField.vue'),
  p24Bank: () => import('./fields/P24BankField.vue'),
  iban: () => import('./fields/IbanField.vue'),
  auBankAccount: () => import('./fields/AuBankAccountField.vue'),
  paymentMethodMessaging: () => import('./fields/PaymentMessagingField.vue'),
  linkAuthentication: () => import('./fields/LinkAuthenticationField.vue'),
  cart: () => import('./fields/CartField.vue'),
  order: () => import('./fields/OrderField.vue'),
  afterpayClearpay: () => import('./fields/AfterpayClearpayField.vue'),
  walletButton: () => import('./fields/WalletButtonField.vue'),
}

const params = new URLSearchParams(window.location.search)
const elementType = params.get('elementType') ?? 'card'
const activeField = shallowRef<Component | null>(null)
const loadError = shallowRef('')

bridge.init()
const group = bridge.getGroup()
if (group) startGroupChannel(group.groupId, group.groupKey)

const loader = FIELD_LOADERS[elementType] ?? FIELD_LOADERS.card
void loader!().then((mod) => {
  activeField.value = mod.default
}).catch(() => {
  loadError.value = t('loadErrorTitle')
  void bridge.send('nexus:error', { type: 'loaderror', message: loadError.value })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as InitPayload
  configureApi({
    apiBase: payload.apiBase,
    publishableKey: payload.publishableKey,
    nexusAccount: payload.nexusAccount,
  })
  void ensureLocale(payload.locale)
  applyAppearance(payload.appearance)
  applyFonts(payload.fonts)
})

bridge.on('nexus:appearance', (message) => {
  applyAppearance(message.payload as ResolvedAppearancePayload)
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options?: Record<string, unknown> }
  const appearance = payload.options?.__appearance as ResolvedAppearancePayload | undefined
  if (appearance?.variables) applyAppearance(appearance)
  const newType = payload.options?.__elementType as string | undefined
  const next = newType ? FIELD_LOADERS[newType] : undefined
  if (next) {
    void next().then((mod) => {
      activeField.value = mod.default
    })
  }
})

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
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
  <p v-if="loadError" class="nexus-error" role="alert" aria-live="assertive">{{ loadError }}</p>
  <component :is="activeField" v-else-if="activeField" />
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
