<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'

const options = ref<Record<string, unknown>>({})

const CURRENCY_CONFIG: Record<string, { symbol: string; maxAmount: number; brand: Record<string, string> }> = {
  USD: { symbol: '$', maxAmount: 200000, brand: { 'en-US': 'Afterpay' } },
  CAD: { symbol: 'C$', maxAmount: 200000, brand: { 'en-CA': 'Afterpay' } },
  AUD: { symbol: 'A$', maxAmount: 200000, brand: { 'en-AU': 'Afterpay' } },
  NZD: { symbol: 'NZ$', maxAmount: 200000, brand: { 'en-NZ': 'Afterpay' } },
  GBP: { symbol: '£', maxAmount: 100000, brand: { 'en-GB': 'Clearpay' } },
  EUR: { symbol: '€', maxAmount: 200000, brand: { 'fr-FR': 'Clearpay', 'es-ES': 'Clearpay', 'it-IT': 'Clearpay', 'de-DE': 'Clearpay' } },
}

const LOCALE_BRAND: Record<string, string> = {
  'en-US': 'Afterpay', 'en-AU': 'Afterpay', 'en-NZ': 'Afterpay', 'en-CA': 'Afterpay',
  'en-GB': 'Clearpay', 'fr-FR': 'Clearpay', 'es-ES': 'Clearpay', 'it-IT': 'Clearpay', 'de-DE': 'Clearpay',
}

const currency = computed(() => {
  const c = (options.value.currency as string)?.toUpperCase() ?? 'USD'
  return CURRENCY_CONFIG[c] ? c : 'USD'
})

const DEFAULT_CONFIG = CURRENCY_CONFIG['USD']!

const config = computed(() => CURRENCY_CONFIG[currency.value] ?? DEFAULT_CONFIG)

const amount = computed(() => Number(options.value.amount) || 0)

const locale = computed(() => (options.value.locale as string) || 'en-US')

const brandName = computed(() => LOCALE_BRAND[locale.value] ?? 'Afterpay')

const style = computed(() => options.value.style === 'compact' ? 'compact' : 'default')
const showLearnMore = computed(() => options.value.showLearnMore !== false)

const isWithinLimit = computed(() => amount.value > 0 && amount.value <= config.value.maxAmount)

const maxAmountDisplay = computed(() => formatPrice(config.value.maxAmount))

function formatPrice(cents: number): string {
  return config.value.symbol + (cents / 100).toFixed(2)
}

const isEmpty = computed(() => amount.value <= 0)

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'afterpayClearpay' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})
</script>

<template>
  <div class="nexus-apc" :class="`nexus-apc--${style}`">
    <template v-if="isEmpty">
      <p class="nexus-apc-empty">请输入商品金额以查看分期信息</p>
    </template>

    <template v-else-if="!isWithinLimit">
      <p class="nexus-apc-over-limit">
        该金额超出 {{ brandName }} 的限额（最高 {{ maxAmountDisplay }}），无法使用此支付方式。
      </p>
    </template>

    <template v-else>
      <div v-if="style === 'default'" class="nexus-apc-default">
        <p class="nexus-apc-message">
          或 4 期免息，每期 <strong>{{ formatPrice(amount / 4) }}</strong>，共 {{ formatPrice(amount) }}。
          由 <span class="nexus-apc-brand">{{ brandName }}</span> 提供。
        </p>
        <p v-if="showLearnMore" class="nexus-apc-learn-more">
          <a href="#" @click.prevent>了解更多</a>
        </p>
      </div>

      <div v-else class="nexus-apc-compact">
        <span class="nexus-apc-compact-text">
          4 × {{ formatPrice(amount / 4) }} 免息 · <span class="nexus-apc-brand">{{ brandName }}</span>
        </span>
        <a v-if="showLearnMore" href="#" class="nexus-apc-compact-link" @click.prevent>?</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nexus-apc {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2937;
  padding: 12px 0;
}

.nexus-apc-empty,
.nexus-apc-over-limit {
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  padding: 8px;
}

.nexus-apc-over-limit {
  color: #dc2626;
}

.nexus-apc-default {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.nexus-apc-message {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.nexus-apc-brand {
  font-weight: 700;
  color: #7c3aed;
}

.nexus-apc-learn-more {
  font-size: 12px;
  margin: 0;
}

.nexus-apc-learn-more a {
  color: #635bff;
  text-decoration: none;
}

.nexus-apc-learn-more a:hover {
  text-decoration: underline;
}

.nexus-apc-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nexus-apc-compact-text {
  font-size: 12px;
  color: #374151;
}

.nexus-apc-compact-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 10px;
  text-decoration: none;
  line-height: 1;
}

.nexus-apc-compact-link:hover {
  background: #d1d5db;
}
</style>
