<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'
import { isApplePayAvailable, isGooglePayAvailable, startApplePay, startGooglePay } from '../wallets/native'
import { t } from '../i18n'

type WalletType = 'applePay' | 'googlePay' | 'paypal' | 'link'
type ButtonTheme = 'black' | 'white' | 'white-outline'
type ButtonVerb = 'pay' | 'buy' | 'book' | 'donate' | 'plain'

const ALL_WALLETS: WalletType[] = ['applePay', 'googlePay', 'paypal', 'link']

const WALLET_LABELS: Record<WalletType, string> = {
  applePay: 'Apple Pay',
  googlePay: 'G Pay',
  paypal: 'PayPal',
  link: 'Link',
}

const VERB_LABELS: Record<Exclude<ButtonVerb, 'plain'>, string> = {
  pay: 'Pay with',
  buy: 'Buy with',
  book: 'Book with',
  donate: 'Donate with',
}

const options = ref<Record<string, unknown>>({})
const processingWallet = ref<WalletType | null>(null)
const resultState = ref<{ wallet: WalletType; status: 'success' | 'fail' } | null>(null)

const nativeSupport: Record<WalletType, () => boolean> = {
  applePay: isApplePayAvailable,
  googlePay: isGooglePayAvailable,
  paypal: () => false,
  link: () => false,
}

const availableWallets = computed<WalletType[]>(() => {
  const config = options.value.paymentMethods as Record<string, 'auto' | 'always' | 'never'> | undefined
  return ALL_WALLETS.filter((wallet) => {
    const setting = config?.[wallet] ?? 'auto'
    if (setting === 'never') return false
    if (setting === 'always') return true
    // auto: show a native wallet when the device supports it, and keep a mock
    // button in insecure/demo contexts so the element is still usable.
    if (nativeSupport[wallet]()) return true
    return options.value.mockWallets !== false
  })
})

const layoutDirection = computed(() => {
  const layout = options.value.layout as { type?: 'horizontal' | 'vertical'; maxColumns?: number } | undefined
  return layout?.type === 'vertical' ? 'vertical' : 'horizontal'
})

const maxColumns = computed(() => {
  const layout = options.value.layout as { maxColumns?: number } | undefined
  return layout?.maxColumns ?? 4
})

const buttonHeight = computed(() => {
  const height = options.value.buttonHeight
  return typeof height === 'number' ? `${height}px` : '40px'
})

function themeFor(wallet: WalletType): ButtonTheme {
  const config = options.value.buttonTheme as Record<string, ButtonTheme> | undefined
  return config?.[wallet] ?? config?.default ?? 'black'
}

function verbFor(wallet: WalletType): ButtonVerb {
  const config = options.value.buttonType as Record<string, ButtonVerb> | undefined
  return config?.[wallet] ?? config?.default ?? 'plain'
}

function labelFor(wallet: WalletType): string {
  const verb = verbFor(wallet)
  if (verb === 'plain') return WALLET_LABELS[wallet]
  return `${VERB_LABELS[verb]} ${WALLET_LABELS[wallet]}`
}

function stateFor(wallet: WalletType): string {
  if (resultState.value?.wallet === wallet) return resultState.value.status
  return ''
}

function displayFor(wallet: WalletType): string {
  if (resultState.value?.wallet === wallet) return resultState.value.status === 'success' ? '✓' : '✕'
  if (processingWallet.value === wallet) return '…'
  return labelFor(wallet)
}

async function onClick(wallet: WalletType) {
  if (processingWallet.value) return
  processingWallet.value = wallet
  const business = options.value.business as { amount?: number; currency?: string; name?: string; country?: string } | undefined
  const request = {
    amount: business?.amount ?? 0,
    currency: business?.currency ?? 'usd',
    label: business?.name ?? 'Total',
    countryCode: business?.country,
  }
  try {
    if (wallet === 'applePay' && isApplePayAvailable()) {
      const token = await startApplePay(request)
      if (!token) {
        processingWallet.value = null
        bridge.send('nexus:cancel', { walletType: wallet })
        return
      }
      bridge.send('nexus:confirm', { walletType: wallet, token })
      return
    }
    if (wallet === 'googlePay' && isGooglePayAvailable()) {
      const token = await startGooglePay(request)
      if (!token) {
        processingWallet.value = null
        bridge.send('nexus:cancel', { walletType: wallet })
        return
      }
      bridge.send('nexus:confirm', { walletType: wallet, token })
      return
    }
  } catch {
    // Native wallets throw outside Safari/Chrome merchant setups. Fall through to the mock.
  }
  bridge.send('nexus:confirm', { walletType: wallet, mock: !nativeSupport[wallet]() })
}

function onCancel() {
  processingWallet.value = null
  resultState.value = null
  bridge.send('nexus:cancel', {})
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', {
    elementType: 'expressCheckout',
    availablePaymentMethods: Object.fromEntries(availableWallets.value.map((wallet) => [wallet, true])),
  })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  bridge.send('nexus:ready', {
    elementType: 'expressCheckout',
    availablePaymentMethods: Object.fromEntries(availableWallets.value.map((wallet) => [wallet, true])),
  })
})

bridge.on('nexus:complete', (message) => {
  const payload = message.payload as { status: 'success' | 'fail' }
  const wallet = processingWallet.value
  processingWallet.value = null
  if (!wallet) return
  resultState.value = { wallet, status: payload.status }
  setTimeout(() => {
    resultState.value = null
  }, 2000)
})
</script>

<template>
  <div
    class="nexus-express-checkout"
    :class="`nexus-express-checkout--${layoutDirection}`"
    :style="layoutDirection === 'vertical' ? { gridTemplateColumns: '1fr' } : { gridTemplateColumns: `repeat(${maxColumns}, 1fr)` }"
  >
    <button
      v-for="wallet in availableWallets"
      :key="wallet"
      type="button"
      class="nexus-wallet-btn"
      :class="[
        `nexus-wallet-btn--${themeFor(wallet)}`,
        { 'nexus-wallet-btn--processing': processingWallet === wallet },
        { 'nexus-wallet-btn--success': stateFor(wallet) === 'success' },
        { 'nexus-wallet-btn--fail': stateFor(wallet) === 'fail' },
      ]"
      :data-wallet="wallet"
      :style="{ height: buttonHeight }"
      :disabled="processingWallet !== null"
      :aria-label="displayFor(wallet)"
      @click="onClick(wallet)"
    >
      {{ displayFor(wallet) }}
    </button>
    <button
      v-if="processingWallet"
      type="button"
      class="nexus-wallet-cancel"
      :aria-label="t('ariaCancelWallet')"
      @click="onCancel"
    >
      {{ t('walletCancel') }}
    </button>
  </div>
</template>

<style scoped>
.nexus-express-checkout {
  display: grid;
  gap: 8px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
}

.nexus-wallet-btn {
  border: none;
  border-radius: var(--nexus-border-radius, 6px);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, background-color 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 12px;
}

.nexus-wallet-btn:disabled {
  cursor: default;
}

.nexus-wallet-btn:focus-visible {
  outline: 2px solid var(--nexus-color-primary, #635bff);
  outline-offset: 2px;
}

.nexus-wallet-btn--black {
  background: #000;
  color: #fff;
}

.nexus-wallet-btn--white {
  background: #fff;
  color: #000;
}

.nexus-express-checkout--vertical {
  grid-template-columns: 1fr;
}
.nexus-wallet-cancel {
  grid-column: 1 / -1;
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  background: transparent;
  border-radius: var(--nexus-border-radius, 6px);
  padding: 8px;
  cursor: pointer;
}
.nexus-wallet-btn--white-outline {
  background: #fff;
  color: #000;
  box-shadow: inset 0 0 0 1px #000;
}

.nexus-wallet-btn--processing {
  opacity: 0.6;
}

.nexus-wallet-btn--success {
  background: #30b130;
  color: #fff;
}

.nexus-wallet-btn--fail {
  background: #df1b41;
  color: #fff;
}
</style>
