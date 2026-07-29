<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Nexus } from '@nexus-elements/core'
import type { CheckoutSessionComplete, EmbeddedCheckoutInstance } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const containerRef = ref<HTMLElement | null>(null)
const sessionId = ref('')
const completed = ref<CheckoutSessionComplete | null>(null)
const error = ref('')

let checkout: EmbeddedCheckoutInstance | null = null

onMounted(async () => {
  try {
    const res = await fetch('/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        mode: 'payment',
        ui_mode: 'embedded',
        amount: 12900,
        currency: 'cny',
        line_items: [
          { name: 'Nexus Pro 年度订阅', amount: 9900, quantity: 1 },
          { name: '优先支持服务', amount: 3000, quantity: 1 },
        ],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error?.message ?? '创建结账会话失败'
      return
    }

    sessionId.value = data.checkout_session.id
    const nexus = new Nexus(PUBLISHABLE_KEY)
    checkout = nexus.initEmbeddedCheckout({
      clientSecret: data.checkout_session.client_secret,
      onComplete(session) {
        completed.value = session
      },
    })
    checkout.mount(containerRef.value!)
  } catch (err) {
    error.value = `网络错误: ${(err as Error).message}`
  }
})

onBeforeUnmount(() => {
  checkout?.destroy()
})
</script>

<template>
  <div class="payment-card">
    <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
    <h1>Embedded Checkout</h1>
    <p class="subtitle">托管结账页内嵌 — initEmbeddedCheckout（CFM-004）</p>

    <p v-if="sessionId" class="session-id">会话: {{ sessionId }}</p>

    <div ref="containerRef" class="checkout-container"></div>

    <div v-if="completed" class="result-box result-box--success">
      结账完成！{{ completed.id }} · {{ completed.status }} · {{ completed.payment_intent }}
    </div>
    <div v-if="error" class="result-box result-box--error">{{ error }}</div>
  </div>
</template>

<style scoped>
.checkout-container {
  height: 460px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #f6f8fa;
}

.session-id {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}
</style>
