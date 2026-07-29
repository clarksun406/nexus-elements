<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'

const options = ref<Record<string, unknown>>({})

const WALLET_CONFIG: Record<string, { label: string; defaultTheme: string }> = {
  applePay: { label: ' Apple Pay', defaultTheme: 'black' },
  googlePay: { label: 'Google Pay', defaultTheme: 'white' },
  paypal: { label: 'PayPal', defaultTheme: 'gold' },
  link: { label: 'Link', defaultTheme: 'black' },
}

const TYPE_LABELS: Record<string, string> = {
  pay: 'Pay',
  buy: 'Buy',
  book: 'Book',
  donate: 'Donate',
  plain: '',
}

const wallet = computed(() => {
  const w = options.value.wallet as string
  return WALLET_CONFIG[w] ? w : 'applePay'
})

const DEFAULT_WALLET = WALLET_CONFIG['applePay']!

const config = computed(() => WALLET_CONFIG[wallet.value] ?? DEFAULT_WALLET)

const theme = computed(() => {
  const t = options.value.buttonTheme as string
  return t || config.value.defaultTheme
})

const buttonType = computed(() => {
  const t = options.value.buttonType as string
  return TYPE_LABELS[t] !== undefined ? t : 'pay'
})

const height = computed(() => Number(options.value.buttonHeight) || 48)
const disabled = computed(() => !!options.value.disabled)

const buttonLabel = computed(() => {
  const prefix = wallet.value === 'applePay' ? '' : TYPE_LABELS[buttonType.value]
  if (!prefix) return config.value.label
  return `${prefix} with ${config.value.label}`
})

const buttonClass = computed(() => {
  const t = theme.value
  return `nexus-wb nexus-wb--${wallet.value} nexus-wb--${t}`
})

function handleClick() {
  if (disabled.value) return
  bridge.send('nexus:confirm', { wallet: wallet.value })
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'walletButton' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})
</script>

<template>
  <div class="nexus-wb-container">
    <button
      :class="buttonClass"
      :style="{ height: height + 'px' }"
      :disabled="disabled"
      :aria-label="buttonLabel"
      @click="handleClick"
    >
      <span class="nexus-wb-text">{{ buttonLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.nexus-wb-container {
  padding: 8px 0;
}

.nexus-wb {
  width: 100%;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
}

.nexus-wb:hover:not(:disabled) {
  opacity: 0.9;
}

.nexus-wb:focus-visible {
  outline: 2px solid var(--nexus-color-primary, #635bff);
  outline-offset: 2px;
}

.nexus-wb:active:not(:disabled) {
  transform: scale(0.98);
}

.nexus-wb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nexus-wb--applePay.nexus-wb--black {
  background: #000;
  color: #fff;
}

.nexus-wb--applePay.nexus-wb--white {
  background: #fff;
  color: #000;
  border: 1px solid #d1d5db;
}

.nexus-wb--googlePay.nexus-wb--black {
  background: #000;
  color: #fff;
}

.nexus-wb--googlePay.nexus-wb--white {
  background: #fff;
  color: #000;
  border: 1px solid #d1d5db;
}

.nexus-wb--googlePay.nexus-wb--white-outline {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.nexus-wb--paypal {
  background: #ffc439;
  color: #003087;
}

.nexus-wb--link.nexus-wb--black {
  background: #635bff;
  color: #fff;
}

.nexus-wb--link.nexus-wb--white {
  background: #f6f9ff;
  color: #635bff;
  border: 1px solid #e5e7eb;
}

.nexus-wb-text {
  letter-spacing: 0.3px;
}
</style>
