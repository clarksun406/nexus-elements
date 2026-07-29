<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusWalletButtonElement } from '@nexus-elements/vue'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const wallet = ref<'applePay' | 'googlePay' | 'paypal' | 'link'>('applePay')
const theme = ref<'black' | 'white' | 'white-outline'>('black')
const buttonType = ref<'pay' | 'buy' | 'book' | 'donate' | 'plain'>('pay')
const height = ref(48)
const disabled = ref(false)

const walletOptions = computed(() => ({
  wallet: wallet.value,
  buttonTheme: theme.value,
  buttonType: buttonType.value,
  buttonHeight: height.value,
  disabled: disabled.value,
}))

const wallets = [
  { value: 'applePay' as const, label: ' Apple Pay' },
  { value: 'googlePay' as const, label: 'Google Pay' },
  { value: 'paypal' as const, label: 'PayPal' },
  { value: 'link' as const, label: 'Link' },
]

const themes = [
  { value: 'black' as const, label: 'Black' },
  { value: 'white' as const, label: 'White' },
  { value: 'white-outline' as const, label: 'White Outline' },
]

const types = [
  { value: 'pay' as const, label: 'Pay' },
  { value: 'buy' as const, label: 'Buy' },
  { value: 'book' as const, label: 'Book' },
  { value: 'donate' as const, label: 'Donate' },
  { value: 'plain' as const, label: 'Plain' },
]
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Wallet Button Element</h1>
      <p class="subtitle">单钱包按钮 — Apple Pay / Google Pay / PayPal / Link</p>

      <div class="controls">
        <div class="control-row">
          <label>钱包</label>
          <div class="btn-group">
            <button v-for="w in wallets" :key="w.value" :class="{ active: wallet === w.value }" @click="wallet = w.value">{{ w.label }}</button>
          </div>
        </div>
        <div class="control-row">
          <label>主题</label>
          <div class="btn-group">
            <button v-for="t in themes" :key="t.value" :class="{ active: theme === t.value }" @click="theme = t.value">{{ t.label }}</button>
          </div>
        </div>
        <div class="control-row">
          <label>类型</label>
          <div class="btn-group">
            <button v-for="t in types" :key="t.value" :class="{ active: buttonType === t.value }" @click="buttonType = t.value">{{ t.label }}</button>
          </div>
        </div>
        <div class="control-row">
          <label>高度</label>
          <input type="range" :min="36" :max="64" :step="4" v-model.number="height" class="range-input" />
          <span class="height-value">{{ height }}px</span>
        </div>
        <div class="control-row">
          <label>禁用</label>
          <label class="toggle">
            <input type="checkbox" v-model="disabled" />
            <span>{{ disabled ? '是' : '否' }}</span>
          </label>
        </div>
      </div>

      <div class="wallet-box">
        <NexusWalletButtonElement :key="`${wallet}-${theme}-${buttonType}-${height}`" :options="walletOptions" />
      </div>

      <div class="all-wallets">
        <h3>全部钱包预览</h3>
        <div v-for="w in wallets" :key="w.value" class="wallet-preview">
          <span class="wallet-label">{{ w.label }}</span>
          <NexusWalletButtonElement :options="{ wallet: w.value, buttonType: 'pay' }" />
        </div>
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

.btn-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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

.range-input {
  flex: 1;
  accent-color: #635bff;
}

.height-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 40px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
}

.wallet-box {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.all-wallets {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.all-wallets h3 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 10px;
}

.wallet-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.wallet-preview:last-child {
  margin-bottom: 0;
}

.wallet-label {
  font-size: 12px;
  color: #6b7280;
  width: 80px;
  flex-shrink: 0;
}

.wallet-preview > :last-child {
  flex: 1;
}
</style>
