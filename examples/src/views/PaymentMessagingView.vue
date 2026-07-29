<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusPaymentMethodMessagingElement } from '@nexus-elements/vue'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const amount = ref(9900)
const currency = ref('USD')
const style = ref<'default' | 'compact'>('default')
const brands = ref<string[]>(['afterpay_clearpay', 'klarna', 'affirm'])

const messagingOptions = computed(() => ({
  amount: amount.value,
  currency: currency.value,
  style: style.value,
  paymentMethodTypes: brands.value,
  showLearnMore: true,
}))

const products = [
  { name: 'Nexus Pro 年度订阅', price: 9900 },
  { name: '无线蓝牙耳机', price: 4900 },
  { name: '手机壳', price: 1900 },
]

function setAmount(price: number) {
  amount.value = price
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CNY: '¥',
}

function formatPrice(cents: number): string {
  const sym = CURRENCY_SYMBOLS[currency.value] ?? currency.value + ' '
  return sym + (cents / 100).toFixed(2)
}

function toggleBrand(brand: string) {
  const idx = brands.value.indexOf(brand)
  if (idx >= 0) brands.value.splice(idx, 1)
  else brands.value.push(brand)
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Payment Method Messaging</h1>
      <p class="subtitle">BNPL 分期信息展示 — Afterpay / Klarna / Affirm / PayPal</p>

      <div class="product-list">
        <h3>选择商品</h3>
        <div
          v-for="product in products"
          :key="product.name"
          class="product-item"
          :class="{ 'product-item--selected': amount === product.price }"
          @click="setAmount(product.price)"
        >
          <span>{{ product.name }}</span>
          <span>{{ formatPrice(product.price) }}</span>
        </div>
      </div>

      <div class="controls">
        <div class="control-row">
          <label>货币</label>
          <select v-model="currency">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
        <div class="control-row">
          <label>样式</label>
          <select v-model="style">
            <option value="default">Default</option>
            <option value="compact">Compact</option>
          </select>
        </div>
        <div class="control-row">
          <label>品牌</label>
          <div class="brand-toggles">
            <button :class="{ active: brands.includes('afterpay_clearpay') }" @click="toggleBrand('afterpay_clearpay')">Afterpay</button>
            <button :class="{ active: brands.includes('klarna') }" @click="toggleBrand('klarna')">Klarna</button>
            <button :class="{ active: brands.includes('affirm') }" @click="toggleBrand('affirm')">Affirm</button>
            <button :class="{ active: brands.includes('paypal') }" @click="toggleBrand('paypal')">PayPal</button>
          </div>
        </div>
      </div>

      <div class="messaging-box">
        <NexusPaymentMethodMessagingElement :key="`${currency}-${style}-${brands.join(',')}`" :options="messagingOptions" />
      </div>

      <p class="amount-display">当前金额：{{ formatPrice(amount) }}</p>
    </div>
  </NexusElements>
</template>

<style scoped>
.product-list {
  margin-bottom: 16px;
}

.product-list h3 {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
  margin-bottom: 8px;
}

.product-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.product-item:hover {
  border-color: #635bff;
}

.product-item--selected {
  border-color: #635bff;
  background: #f8f7ff;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.control-row select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.brand-toggles {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.brand-toggles button {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.brand-toggles button.active {
  background: #635bff;
  color: #fff;
  border-color: #635bff;
}

.messaging-box {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 12px;
  min-height: 60px;
}

.amount-display {
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
</style>
