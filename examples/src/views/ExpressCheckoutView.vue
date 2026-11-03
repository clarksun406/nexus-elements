<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusExpressCheckoutElement } from '@nexus-elements/vue'
import type { Nexus } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

interface ExpressConfirmEvent {
  walletType: string
  complete: (status: 'success' | 'fail') => void
}

const buttonTheme = ref<'black' | 'white' | 'white-outline'>('black')
const buttonType = ref<'plain' | 'pay' | 'buy' | 'donate'>('plain')
const maxColumns = ref(4)
const availableMethods = ref<Record<string, boolean>>({})
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null)

let nexus: Nexus | null = null

const elementOptions = computed(() => ({
  buttonTheme: { default: buttonTheme.value },
  buttonType: { default: buttonType.value },
  buttonHeight: 44,
  layout: { maxColumns: maxColumns.value },
}))

function onProviderReady(nexusInstance: Nexus) {
  nexus = nexusInstance
}

function onElementReady(event: unknown) {
  const e = event as { availablePaymentMethods?: Record<string, boolean> }
  if (e.availablePaymentMethods) availableMethods.value = e.availablePaymentMethods
}

async function onConfirm(event: unknown) {
  const { walletType, complete } = event as ExpressConfirmEvent
  result.value = null

  try {
    const intentRes = await fetch('/v1/payment_intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        amount: 9900,
        currency: 'cny',
        description: `Nexus Demo 订单（${walletType}）`,
      }),
    })
    const intentData = await intentRes.json()
    if (!intentRes.ok || !nexus) {
      complete('fail')
      result.value = { type: 'error', message: intentData.error?.message ?? '创建支付失败' }
      return
    }

    const tokenRes = await fetch('/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({ payment_method_type: walletType }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      complete('fail')
      result.value = { type: 'error', message: tokenData.error?.message ?? '钱包授权失败' }
      return
    }

    const { error, paymentIntent } = await nexus.confirmPayment({
      clientSecret: intentData.payment_intent.client_secret,
      paymentMethodId: tokenData.payment_method_id,
    })

    if (error || paymentIntent?.status !== 'succeeded') {
      complete('fail')
      result.value = { type: 'error', message: error?.message ?? `支付状态: ${paymentIntent?.status}` }
      return
    }

    complete('success')
    result.value = { type: 'success', message: `支付成功！${paymentIntent.id} · 钱包: ${walletType} · ¥99.00` }
  } catch (err) {
    complete('fail')
    result.value = { type: 'error', message: `网络错误: ${(err as Error).message}` }
  }
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html" @ready="onProviderReady">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>快捷支付</h1>
      <p class="subtitle">Express Checkout — 钱包按钮 / 样式 / 布局</p>

      <div class="amount-display">¥ 99.00</div>

      <div class="field-group">
        <NexusExpressCheckoutElement :options="elementOptions" @ready="onElementReady" @confirm="onConfirm" />
      </div>

      <p class="available-line">
        可用钱包（ready 事件透出）：{{ Object.keys(availableMethods).join(' / ') || '检测中...' }}
      </p>

      <div class="chip-row">
        <span class="chip-label">主题</span>
        <button
          v-for="t in (['black', 'white', 'white-outline'] as const)"
          :key="t"
          class="chip"
          :class="{ 'chip--active': buttonTheme === t }"
          @click="buttonTheme = t"
        >
          {{ t }}
        </button>
      </div>

      <div class="chip-row">
        <span class="chip-label">类型</span>
        <button
          v-for="t in (['plain', 'pay', 'buy', 'donate'] as const)"
          :key="t"
          class="chip"
          :class="{ 'chip--active': buttonType === t }"
          @click="buttonType = t"
        >
          {{ t }}
        </button>
      </div>

      <div class="chip-row">
        <span class="chip-label">列数</span>
        <button
          v-for="c in [1, 2, 4]"
          :key="c"
          class="chip"
          :class="{ 'chip--active': maxColumns === c }"
          @click="maxColumns = c"
        >
          {{ c }}
        </button>
      </div>

      <div v-if="result" class="result-box" :class="result.type === 'success' ? 'result-box--success' : 'result-box--error'">
        {{ result.message }}
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.available-line {
  margin: 12px 0;
  font-size: 13px;
  color: #6b7280;
}

.chip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.chip-label {
  font-size: 13px;
  color: #6b7280;
  min-width: 32px;
}

.chip {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.15s;
}

.chip:hover {
  border-color: #635bff;
  color: #635bff;
}

.chip--active {
  background: #635bff;
  border-color: #635bff;
  color: #fff;
}
</style>
