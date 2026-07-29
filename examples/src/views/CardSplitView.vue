<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusCardNumberElement, NexusCardExpiryElement, NexusCardCvcElement } from '@nexus-elements/vue'
import { createNexus } from '@nexus-elements/core'
import type { ChangeEvent, NexusElement as NexusElementInstance } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'
const nexus = createNexus(PUBLISHABLE_KEY)

const numberRef = ref<{ getElement: () => NexusElementInstance | undefined } | null>(null)
const numberComplete = ref(false)
const expiryComplete = ref(false)
const cvcComplete = ref(false)
const loading = ref(false)
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const brand = ref('')

const allComplete = computed(() => numberComplete.value && expiryComplete.value && cvcComplete.value)

function onNumberChange(event: unknown) {
  const e = event as ChangeEvent
  numberComplete.value = e.complete
  brand.value = e.brand ?? ''
}

function onExpiryChange(event: unknown) {
  expiryComplete.value = (event as ChangeEvent).complete
}

function onCvcChange(event: unknown) {
  cvcComplete.value = (event as ChangeEvent).complete
}

async function handlePay() {
  loading.value = true
  result.value = null

  try {
    const intentRes = await fetch('/v1/payment_intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        amount: 19900,
        currency: 'cny',
        description: 'Nexus Demo 订单（拆分模式）',
      }),
    })
    const intentData = await intentRes.json()
    if (!intentRes.ok) {
      result.value = { type: 'error', message: intentData.error?.message ?? '创建支付失败' }
      return
    }

    const element = numberRef.value?.getElement()
    if (!element) {
      result.value = { type: 'error', message: 'Element 未就绪' }
      return
    }

    const { error, paymentIntent } = await nexus.confirmCardPayment(
      intentData.payment_intent.client_secret,
      { payment_method: { card: element } },
    )

    if (error) {
      result.value = { type: 'error', message: error.message }
    } else if (paymentIntent?.status === 'succeeded') {
      result.value = { type: 'success', message: `支付成功！${paymentIntent.id} · 品牌: ${brand.value || 'unknown'}` }
    } else {
      result.value = { type: 'success', message: `支付状态: ${paymentIntent?.status}` }
    }
  } catch (err) {
    result.value = { type: 'error', message: `网络错误: ${(err as Error).message}` }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>银行卡支付</h1>
      <p class="subtitle">拆分模式 — cardNumber / cardExpiry / cardCvc 独立字段</p>

      <div class="amount-display">¥ 199.00</div>

      <div class="field-group">
        <label class="field-label">卡号</label>
        <NexusCardNumberElement ref="numberRef" :options="{ showIcon: true }" @change="onNumberChange" />
      </div>

      <div class="split-row">
        <div class="field-group">
          <label class="field-label">有效期</label>
          <NexusCardExpiryElement @change="onExpiryChange" />
        </div>
        <div class="field-group">
          <label class="field-label">CVC</label>
          <NexusCardCvcElement @change="onCvcChange" />
        </div>
      </div>

      <button class="btn-pay" :disabled="!allComplete || loading" @click="handlePay">
        {{ loading ? '处理中...' : '支付 ¥199.00' }}
      </button>

      <div v-if="result" class="result-box" :class="result.type === 'success' ? 'result-box--success' : 'result-box--error'">
        {{ result.message }}
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
