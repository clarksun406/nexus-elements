<script setup lang="ts">
import { ref } from 'vue'
import { Nexus } from '@nexus-elements/core'
import type { CheckoutSession } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const loading = ref(false)
const error = ref('')

async function handleRedirect() {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch('/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        mode: 'payment',
        ui_mode: 'redirect',
        amount: 12900,
        currency: 'cny',
        success_url: `${window.location.origin}/redirect-success?session_id={SESSION_ID}`,
        cancel_url: `${window.location.origin}/redirect-checkout`,
        line_items: [
          { name: 'Nexus Pro 年度订阅', amount: 9900, quantity: 1 },
          { name: '优先支持服务', amount: 3000, quantity: 1 },
        ],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error?.message ?? '创建结账会话失败'
      loading.value = false
      return
    }

    const session = data.checkout_session as CheckoutSession
    const nexus = new Nexus(PUBLISHABLE_KEY)
    nexus.redirectToCheckout(session)
  } catch (err) {
    error.value = `网络错误: ${(err as Error).message}`
    loading.value = false
  }
}
</script>

<template>
  <div class="payment-card">
    <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
    <h1>Redirect Checkout</h1>
    <p class="subtitle">跳转托管结账页 — redirectToCheckout</p>

    <div class="order-summary">
      <h3>订单摘要</h3>
      <div class="line-item">
        <span>Nexus Pro 年度订阅</span>
        <span>¥99.00</span>
      </div>
      <div class="line-item">
        <span>优先支持服务</span>
        <span>¥30.00</span>
      </div>
      <div class="line-item total">
        <span>合计</span>
        <span>¥129.00</span>
      </div>
    </div>

    <button class="pay-btn" :disabled="loading" @click="handleRedirect">
      {{ loading ? '跳转中...' : '前往支付' }}
    </button>

    <div v-if="error" class="result-box result-box--error">{{ error }}</div>

    <p class="hint">
      点击后将跳转至托管结账页完成支付，支付成功后自动返回。
    </p>
  </div>
</template>

<style scoped>
.order-summary {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.order-summary h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #6b7280;
  font-weight: 600;
}

.line-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0;
  color: #374151;
}

.line-item.total {
  border-top: 1px solid #e5e7eb;
  margin-top: 8px;
  padding-top: 10px;
  font-weight: 700;
  font-size: 16px;
}

.pay-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #635bff;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.pay-btn:hover:not(:disabled) {
  background: #5147e5;
}

.pay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin-top: 12px;
}
</style>
