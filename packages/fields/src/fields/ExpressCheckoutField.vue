<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'

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

const availableWallets = computed<WalletType[]>(() => {
  const config = options.value.paymentMethods as Record<string, 'auto' | 'always' | 'never'> | undefined
  return ALL_WALLETS.filter((wallet) => {
    const setting = config?.[wallet] ?? 'auto'
    if (setting === 'never') return false
    if (setting === 'always') return true
    // 'auto': real SDK availability detection is mocked — all wallets report available
    return true
  })
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

function onClick(wallet: WalletType) {
  if (processingWallet.value) return
  processingWallet.value = wallet
  bridge.send('nexus:confirm', { walletType: wallet })
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
    :style="{ gridTemplateColumns: `repeat(${maxColumns}, 1fr)` }"
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
