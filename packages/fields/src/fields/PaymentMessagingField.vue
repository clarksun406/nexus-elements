<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'

interface BnplBrand {
  id: string
  name: string
  maxAmount: Record<string, number>
  installments: number
  logo: string
}

const BNPL_BRANDS: BnplBrand[] = [
  { id: 'afterpay_clearpay', name: 'Afterpay', maxAmount: { USD: 400000, AUD: 200000, CAD: 400000, NZD: 200000, GBP: 300000, EUR: 300000 }, installments: 4, logo: 'A' },
  { id: 'klarna', name: 'Klarna', maxAmount: { USD: 1000000, EUR: 1000000, GBP: 1000000, SEK: 10000000, DKK: 6000000, NOK: 10000000 }, installments: 4, logo: 'K' },
  { id: 'affirm', name: 'Affirm', maxAmount: { USD: 1750000 }, installments: 4, logo: 'Af' },
  { id: 'paypal', name: 'PayPal Pay Later', maxAmount: { USD: 200000, EUR: 200000, GBP: 200000, AUD: 200000 }, installments: 4, logo: 'P' },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', NZD: 'NZ$', SEK: 'kr', DKK: 'kr', NOK: 'kr', CNY: '¥', JPY: '¥',
}

const options = ref<Record<string, unknown>>({})

const amount = computed(() => Number(options.value.amount) || 0)
const currency = computed(() => ((options.value.currency as string) ?? 'USD').toUpperCase())
const paymentMethodTypes = computed(() => (options.value.paymentMethodTypes as string[]) ?? ['afterpay_clearpay', 'klarna', 'affirm'])
const styleMode = computed(() => (options.value.style as string) ?? 'default')
const showLearnMore = computed(() => options.value.showLearnMore !== false)

const symbol = computed(() => CURRENCY_SYMBOLS[currency.value] ?? currency.value + ' ')

function formatAmount(cents: number): string {
  const val = cents / 100
  if (['JPY', 'KRW'].includes(currency.value)) return symbol.value + Math.round(val)
  return symbol.value + val.toFixed(2)
}

interface BrandMessage {
  brand: BnplBrand
  perInstallment: string
  available: boolean
}

const messages = computed<BrandMessage[]>(() => {
  return paymentMethodTypes.value
    .map((type) => {
      const brand = BNPL_BRANDS.find((b) => b.id === type)
      if (!brand) return null
      const maxForCurrency = brand.maxAmount[currency.value] ?? brand.maxAmount.USD ?? 0
      const available = amount.value > 0 && amount.value <= maxForCurrency
      const perInstallment = available ? formatAmount(Math.ceil(amount.value / brand.installments)) : ''
      return { brand, perInstallment, available }
    })
    .filter((m): m is BrandMessage => m !== null)
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'paymentMethodMessaging' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})
</script>

<template>
  <div class="nexus-pmm-element" :class="{ 'nexus-pmm-compact': styleMode === 'compact' }">
    <div v-for="msg in messages" :key="msg.brand.id" class="nexus-pmm-message">
      <span class="nexus-pmm-logo">{{ msg.brand.logo }}</span>
      <span v-if="msg.available" class="nexus-pmm-text">
        Or {{ msg.brand.installments }} interest-free payments of <strong>{{ msg.perInstallment }}</strong> with {{ msg.brand.name }}.
      </span>
      <span v-else class="nexus-pmm-text nexus-pmm-unavailable">
        {{ msg.brand.name }} is not available for this amount.
      </span>
      <a v-if="showLearnMore && msg.available" href="#" class="nexus-pmm-learn-more" @click.prevent>Learn more</a>
    </div>
  </div>
</template>

<style scoped>
.nexus-pmm-element {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  padding: 12px 0;
}

.nexus-pmm-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #4b5563;
  flex-wrap: wrap;
}

.nexus-pmm-compact .nexus-pmm-message {
  font-size: 12px;
  padding: 4px 0;
}

.nexus-pmm-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #f3f4f6;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  flex-shrink: 0;
}

.nexus-pmm-compact .nexus-pmm-logo {
  width: 20px;
  height: 20px;
  font-size: 10px;
  border-radius: 4px;
}

.nexus-pmm-text strong {
  color: #1f2937;
  font-weight: 600;
}

.nexus-pmm-unavailable {
  color: #9ca3af;
  font-style: italic;
}

.nexus-pmm-learn-more {
  font-size: 12px;
  color: #635bff;
  text-decoration: none;
  margin-left: 4px;
}

.nexus-pmm-learn-more:hover {
  text-decoration: underline;
}
</style>
