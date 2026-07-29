<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusCartElement } from '@nexus-elements/vue'
import type { ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const changeEvent = ref<ChangeEvent | null>(null)

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥',
}

function formatPrice(cents: number, currency = 'CNY'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' '
  return sym + (cents / 100).toFixed(2)
}

const cartItems = ref([
  { id: 'prod_1', name: 'Nexus Pro 年度订阅', description: '高级版功能', unit_amount: 9900, currency: 'CNY', quantity: 1 },
  { id: 'prod_2', name: '无线蓝牙耳机', description: '主动降噪', unit_amount: 4900, currency: 'CNY', quantity: 2 },
  { id: 'prod_3', name: '手机壳', description: '透明防摔', unit_amount: 1900, currency: 'CNY', quantity: 1 },
])

const cartOptions = computed(() => ({
  items: cartItems.value,
  shippingOptions: [
    { id: 'standard', displayName: '标准配送 (3-5天)', amount: 0 },
    { id: 'express', displayName: '加急配送 (1-2天)', amount: 1500 },
    { id: 'same_day', displayName: '当日达', amount: 3000 },
  ],
  taxAmount: 0,
  allowPromoCodes: true,
}))

function onCartChange(event: ChangeEvent) {
  changeEvent.value = event
}

function addItem() {
  const newItem = {
    id: `prod_${Date.now()}`,
    name: '新增商品',
    description: '示例商品',
    unit_amount: 2900,
    currency: 'CNY',
    quantity: 1,
  }
  cartItems.value = [...cartItems.value, newItem]
}

function clearCart() {
  cartItems.value = []
}

function resetCart() {
  cartItems.value = [
    { id: 'prod_1', name: 'Nexus Pro 年度订阅', description: '高级版功能', unit_amount: 9900, currency: 'CNY', quantity: 1 },
    { id: 'prod_2', name: '无线蓝牙耳机', description: '主动降噪', unit_amount: 4900, currency: 'CNY', quantity: 2 },
    { id: 'prod_3', name: '手机壳', description: '透明防摔', unit_amount: 1900, currency: 'CNY', quantity: 1 },
  ]
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Cart Element</h1>
      <p class="subtitle">购物车组件 — 商品列表 / 数量编辑 / 优惠码 / 费用汇总</p>

      <div class="cart-controls">
        <button class="ctrl-btn" @click="addItem">+ 添加商品</button>
        <button class="ctrl-btn ctrl-btn--danger" @click="clearCart">清空购物车</button>
        <button class="ctrl-btn" @click="resetCart">重置</button>
      </div>

      <div class="cart-wrapper">
        <NexusCartElement :key="cartItems.length + '-' + cartItems.map(i => i.id + i.quantity).join(',')" :options="cartOptions" @change="onCartChange" />
      </div>

      <div v-if="changeEvent" class="event-display">
        <h3>Change Event</h3>
        <div class="event-row">
          <span>complete:</span>
          <span :class="changeEvent.complete ? 'val-true' : 'val-false'">{{ changeEvent.complete }}</span>
        </div>
        <div class="event-row">
          <span>empty:</span>
          <span :class="changeEvent.empty ? 'val-true' : 'val-false'">{{ changeEvent.empty }}</span>
        </div>
        <div v-if="changeEvent.value" class="event-details">
          <div class="event-row">
            <span>items:</span>
            <span>{{ (changeEvent.value as any).items?.length ?? 0 }}</span>
          </div>
          <div class="event-row">
            <span>subtotal:</span>
            <span>{{ formatPrice((changeEvent.value as any).subtotal ?? 0) }}</span>
          </div>
          <div class="event-row">
            <span>shipping:</span>
            <span>{{ formatPrice((changeEvent.value as any).shipping ?? 0) }}</span>
          </div>
          <div v-if="(changeEvent.value as any).discount > 0" class="event-row">
            <span>discount:</span>
            <span class="val-true">-{{ formatPrice((changeEvent.value as any).discount) }}</span>
          </div>
          <div class="event-row event-total">
            <span>total:</span>
            <span>{{ formatPrice((changeEvent.value as any).total ?? 0) }}</span>
          </div>
          <div v-if="(changeEvent.value as any).promoCode" class="event-row">
            <span>promo:</span>
            <span class="val-true">{{ (changeEvent.value as any).promoCode }}</span>
          </div>
        </div>
      </div>

      <div class="test-hint">
        <p><strong>测试提示：</strong></p>
        <ul>
          <li>点击 +/− 调整商品数量</li>
          <li>点击 × 删除商品</li>
          <li>选择不同配送方式查看运费变化</li>
          <li>输入优惠码试试：<code>NEXUS10</code>、<code>SAVE20</code>、<code>FREESHIP</code></li>
        </ul>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.cart-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.ctrl-btn {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  border-color: #635bff;
  color: #635bff;
}

.ctrl-btn--danger {
  color: #dc2626;
}

.ctrl-btn--danger:hover {
  border-color: #dc2626;
  color: #dc2626;
}

.cart-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
}

.event-display {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.event-display h3 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.event-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
}

.event-row span:first-child {
  color: #6b7280;
}

.val-true { color: #059669; font-weight: 600; }
.val-false { color: #9ca3af; }

.event-details {
  border-top: 1px solid #f3f4f6;
  margin-top: 6px;
  padding-top: 6px;
}

.event-total {
  font-weight: 700;
  font-size: 13px;
  border-top: 1px solid #e5e7eb;
  padding-top: 4px;
  margin-top: 4px;
}

.event-total span:last-child {
  color: #1f2937;
}

.test-hint {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #6b7280;
}

.test-hint p {
  font-weight: 600;
  margin-bottom: 6px;
}

.test-hint ul {
  padding-left: 18px;
}

.test-hint li {
  margin-bottom: 3px;
}

.test-hint code {
  background: #e5e7eb;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}
</style>
