<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusAfterpayClearpayElement } from '@nexus-elements/vue'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const amount = ref(8000)
const currency = ref<'USD' | 'GBP' | 'AUD' | 'EUR'>('USD')
const locale = ref('en-US')
const style = ref<'default' | 'compact'>('default')

const apcOptions = computed(() => ({
  amount: amount.value,
  currency: currency.value,
  locale: locale.value,
  style: style.value,
  showLearnMore: true,
}))

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', AUD: 'A$', EUR: '€', CAD: 'C$', NZD: 'NZ$',
}

function formatPrice(cents: number): string {
  const sym = CURRENCY_SYMBOLS[currency.value] ?? currency.value + ' '
  return sym + (cents / 100).toFixed(2)
}

const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (US) → Afterpay' },
  { value: 'en-GB', label: 'English (UK) → Clearpay' },
  { value: 'en-AU', label: 'English (AU) → Afterpay' },
  { value: 'fr-FR', label: 'Français → Clearpay' },
  { value: 'de-DE', label: 'Deutsch → Clearpay' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', max: 200000 },
  { value: 'GBP', max: 100000 },
  { value: 'AUD', max: 200000 },
  { value: 'EUR', max: 200000 },
]

function setCurrency(c: string) {
  currency.value = c as typeof currency.value
  const opt = CURRENCY_OPTIONS.find((o) => o.value === c)
  if (opt && amount.value > opt.max) {
    amount.value = Math.round(opt.max / 2)
  }
  const localeMap: Record<string, string> = { USD: 'en-US', GBP: 'en-GB', AUD: 'en-AU', EUR: 'fr-FR' }
  locale.value = localeMap[c] ?? 'en-US'
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Afterpay / Clearpay Element</h1>
      <p class="subtitle">BNPL 分期展示 — 4 期免息 · 地区品牌切换</p>

      <div class="controls">
        <div class="control-row">
          <label>金额</label>
          <input type="range" :min="500" :max="250000" :step="500" v-model.number="amount" class="range-input" />
          <span class="amount-value">{{ formatPrice(amount) }}</span>
        </div>
        <div class="control-row">
          <label>货币</label>
          <div class="btn-group">
            <button v-for="c in CURRENCY_OPTIONS" :key="c.value" :class="{ active: currency === c.value }" @click="setCurrency(c.value)">{{ c.value }}</button>
          </div>
        </div>
        <div class="control-row">
          <label>地区</label>
          <select v-model="locale">
            <option v-for="l in LOCALE_OPTIONS" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>
        </div>
        <div class="control-row">
          <label>样式</label>
          <div class="btn-group">
            <button :class="{ active: style === 'default' }" @click="style = 'default'">Default</button>
            <button :class="{ active: style === 'compact' }" @click="style = 'compact'">Compact</button>
          </div>
        </div>
      </div>

      <div class="apc-box">
        <NexusAfterpayClearpayElement :key="`${currency}-${locale}-${style}-${amount}`" :options="apcOptions" />
      </div>

      <div class="limit-test">
        <h3>限额测试</h3>
        <p class="limit-info">当前限额：{{ formatPrice(CURRENCY_OPTIONS.find(c => c.value === currency)?.max ?? 200000) }}</p>
        <button class="ctrl-btn" @click="amount = 250000">设置为超限金额</button>
        <button class="ctrl-btn" @click="amount = 8000">恢复正常金额</button>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-row label {
  font-size: 13px;
  color: #6b7280;
  width: 40px;
  flex-shrink: 0;
}

.range-input {
  flex: 1;
  accent-color: #635bff;
}

.amount-value {
  font-size: 14px;
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}

.btn-group {
  display: flex;
  gap: 4px;
}

.btn-group button {
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-group button.active {
  background: #635bff;
  color: #fff;
  border-color: #635bff;
}

select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.apc-box {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  min-height: 60px;
}

.limit-test {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.limit-test h3 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
}

.limit-info {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.ctrl-btn {
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  margin-right: 6px;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  border-color: #635bff;
  color: #635bff;
}
</style>
