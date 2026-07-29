<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'
import { createNexus } from '@nexus-elements/core'
import type { Appearance, ChangeEvent, NexusElement as NexusElementInstance } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'
const nexus = createNexus(PUBLISHABLE_KEY)

const THEMES: NonNullable<Appearance['theme']>[] = ['stripe', 'flat', 'night', 'none']
const theme = ref<NonNullable<Appearance['theme']>>('stripe')

const hidePostalCode = ref(false)
const disabled = ref(false)

const elementsOptions = computed(() => ({
  appearance: { theme: theme.value } satisfies Appearance,
  locale: 'zh' as const,
}))

const cardElementRef = ref<{ getElement: () => NexusElementInstance | undefined } | null>(null)
const complete = ref(false)
const loading = ref(false)
const result = ref<{ type: 'success' | 'error' | 'action'; message: string } | null>(null)

const eventLog = ref<{ type: string; time: string }[]>([])
function logEvent(type: string) {
  eventLog.value.unshift({ type, time: new Date().toLocaleTimeString() })
  if (eventLog.value.length > 10) eventLog.value.pop()
}

const cardOptions = computed(() => ({
  showIcon: true,
  hidePostalCode: hidePostalCode.value,
  disabled: disabled.value,
}))

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('status')
  const intentId = params.get('intent')
  if (status === 'approved') {
    result.value = { type: 'success', message: `支付成功！${intentId ?? ''} · 3DS 验证通过 · ¥99.00` }
  } else if (status === 'failed') {
    result.value = { type: 'error', message: `3DS 验证失败（${intentId ?? ''}），请重新支付。` }
  }
})

function onChange(event: unknown) {
  const changeEvent = event as ChangeEvent
  complete.value = changeEvent.complete
}

async function handlePay() {
  loading.value = true
  result.value = null

  try {
    // 1. 惰性创建 PaymentIntent（对标 card-element-classic.html 流程）
    const intentRes = await fetch('/v1/payment_intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        amount: 9900,
        currency: 'cny',
        description: 'Nexus Demo 订单',
        metadata: { demo: 'card-combined' },
      }),
    })
    const intentData = await intentRes.json()
    if (!intentRes.ok) {
      result.value = { type: 'error', message: intentData.error?.message ?? '创建支付失败' }
      return
    }

    // 2. 通过 SDK 确认支付（内部：iframe tokenize → confirm API）
    const element = cardElementRef.value?.getElement()
    if (!element) {
      result.value = { type: 'error', message: 'Element 未就绪' }
      return
    }

    const { error, paymentIntent } = await nexus.confirmCardPayment(
      intentData.payment_intent.client_secret,
      {
        payment_method: { card: element },
        return_url: window.location.origin + window.location.pathname,
      },
    )

    if (error) {
      result.value = { type: 'error', message: `${error.message}${error.decline_code ? ` (${error.decline_code})` : ''}` }
    } else if (paymentIntent?.status === 'succeeded') {
      result.value = { type: 'success', message: `支付成功！${paymentIntent.id} · ¥99.00` }
    } else if (paymentIntent?.status === 'requires_action') {
      result.value = { type: 'action', message: '需要额外验证（3DS），正在跳转...' }
    } else {
      result.value = { type: 'action', message: `支付状态: ${paymentIntent?.status ?? 'unknown'}` }
    }
  } catch (err) {
    result.value = { type: 'error', message: `网络错误: ${(err as Error).message}` }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" :options="elementsOptions" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>银行卡支付</h1>
      <p class="subtitle">Card Element — 合并模式（卡号 + 有效期 + CVC 单字段）</p>

      <div class="amount-display">¥ 99.00</div>

      <div class="theme-switcher">
        <span class="theme-label">主题</span>
        <button
          v-for="t in THEMES"
          :key="t"
          class="theme-btn"
          :class="{ 'theme-btn--active': theme === t }"
          @click="theme = t"
        >
          {{ t }}
        </button>
      </div>

      <div class="toggle-row">
        <label class="toggle-item">
          <input v-model="hidePostalCode" type="checkbox" data-toggle="hidePostalCode" />
          <span>hidePostalCode</span>
        </label>
        <label class="toggle-item">
          <input v-model="disabled" type="checkbox" data-toggle="disabled" />
          <span>disabled</span>
        </label>
      </div>

      <div class="field-group">
        <label class="field-label">银行卡信息</label>
        <NexusCardElement
          ref="cardElementRef"
          :options="cardOptions"
          @change="onChange"
          @focus="logEvent('focus')"
          @blur="logEvent('blur')"
          @error="logEvent('error')"
          @escape="logEvent('escape')"
        />
      </div>

      <div class="method-row">
        <button class="method-btn" data-method="focus" @click="cardElementRef?.getElement()?.focus()">focus()</button>
        <button class="method-btn" data-method="blur" @click="cardElementRef?.getElement()?.blur()">blur()</button>
        <button class="method-btn" data-method="clear" @click="cardElementRef?.getElement()?.clear()">clear()</button>
      </div>

      <button class="btn-pay" :disabled="!complete || loading || disabled" @click="handlePay">
        {{ loading ? '处理中...' : '支付 ¥99.00' }}
      </button>

      <div
        v-if="result"
        class="result-box"
        :class="{
          'result-box--success': result.type === 'success',
          'result-box--error': result.type === 'error',
          'result-box--action': result.type === 'action',
        }"
      >
        {{ result.message }}
      </div>

      <div class="test-hint">
        <p>测试卡号：4242 4242 4242 4242（成功）· 4000 0000 0000 0002（拒绝）· 4000 0000 0000 3220（3DS）</p>
      </div>

      <div class="event-log">
        <div class="event-log-header">
          <span class="event-log-title">事件日志</span>
          <button class="event-clear-btn" @click="eventLog = []">清空</button>
        </div>
        <div class="event-log-body">
          <div v-if="eventLog.length === 0" class="event-empty">暂无事件</div>
          <div v-for="(entry, i) in eventLog" :key="i" class="event-entry">
            <span class="event-time">{{ entry.time }}</span>
            <span class="event-type" :class="`evt-${entry.type}`">{{ entry.type }}</span>
          </div>
        </div>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.theme-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.theme-label {
  font-size: 13px;
  color: #6b7280;
}

.theme-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.15s ease;
}

.theme-btn:hover {
  border-color: #635bff;
  color: #635bff;
}

.theme-btn--active {
  background: #635bff;
  border-color: #635bff;
  color: #fff;
}

.result-box--action {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  color: #1e40af;
}

.test-hint {
  margin-top: 16px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.test-hint p {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}

.toggle-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
}

.toggle-item input {
  accent-color: #635bff;
}

.method-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.method-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 12px;
  font-family: monospace;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}

.method-btn:hover {
  border-color: #635bff;
  color: #635bff;
  background: #f0f0ff;
}

.event-log {
  margin-top: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.event-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.event-log-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.event-clear-btn {
  font-size: 11px;
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
}

.event-clear-btn:hover {
  color: #635bff;
}

.event-log-body {
  max-height: 120px;
  overflow-y: auto;
  padding: 6px 12px;
}

.event-empty {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 8px;
}

.event-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  font-size: 11px;
  border-bottom: 1px solid #f5f5f5;
}

.event-time {
  color: #9ca3af;
  font-family: monospace;
}

.event-type {
  font-weight: 600;
  font-family: monospace;
  padding: 1px 6px;
  border-radius: 3px;
}

.evt-focus { background: #ecfdf5; color: #059669; }
.evt-blur { background: #fef3c7; color: #d97706; }
.evt-error { background: #fef2f2; color: #dc2626; }
.evt-escape { background: #f5f3ff; color: #7c3aed; }
.evt-change { background: #eff6ff; color: #1d4ed8; }
</style>
