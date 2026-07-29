<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusPaymentElement } from '@nexus-elements/vue'
import type { Nexus, NexusElements as NexusElementsInstance, ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

type BillingPeriod = 'monthly' | 'yearly'
const period = ref<BillingPeriod>('monthly')
const complete = ref(false)
const loading = ref(false)
const step = ref<'plan' | 'payment' | 'success'>('plan')
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null)

let nexus: Nexus | null = null
let elements: NexusElementsInstance | null = null

const plans = {
  monthly: { name: '月度订阅', price: 2900, period: '月', label: '¥29.00/月' },
  yearly: { name: '年度订阅', price: 29000, period: '年', label: '¥290.00/年', save: '省 17%' },
}

const currentPlan = computed(() => plans[period.value])

function onReady(nexusInstance: Nexus, elementsInstance: NexusElementsInstance) {
  nexus = nexusInstance
  elements = elementsInstance
}

function onChange(event: unknown) {
  complete.value = (event as ChangeEvent).complete
}

function selectPlan() {
  step.value = 'payment'
  result.value = null
}

function backToPlans() {
  step.value = 'plan'
  result.value = null
}

async function handleSubscribe() {
  if (!nexus || !elements) {
    result.value = { type: 'error', message: 'Elements 未就绪' }
    return
  }

  loading.value = true
  result.value = null

  try {
    const setupRes = await fetch('/v1/setup_intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        usage: 'off_session',
        metadata: {
          plan: period.value,
          amount: currentPlan.value.price,
          currency: 'cny',
        },
      }),
    })
    const setupData = await setupRes.json()
    if (!setupRes.ok) {
      result.value = { type: 'error', message: setupData.error?.message ?? '创建 SetupIntent 失败' }
      loading.value = false
      return
    }

    const { error, setupIntent } = await nexus.confirmSetup({
      elements,
      clientSecret: setupData.setup_intent.client_secret,
      confirmParams: { return_url: window.location.origin + '/billing' },
    })

    if (error) {
      result.value = { type: 'error', message: error.message }
    } else if (setupIntent?.status === 'succeeded') {
      step.value = 'success'
      result.value = {
        type: 'success',
        message: `订阅成功！${currentPlan.value.name} · ${currentPlan.value.label} · ${setupIntent.id}`,
      }
    } else {
      result.value = { type: 'error', message: `SetupIntent 状态: ${setupIntent?.status ?? 'unknown'}` }
    }
  } catch (err) {
    result.value = { type: 'error', message: `网络错误: ${(err as Error).message}` }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html" @ready="onReady">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>订阅支付</h1>
      <p class="subtitle">Billing — 套餐选择 + Payment Element + SetupIntent 自动续费</p>

      <!-- Step 1: Plan Selection -->
      <div v-if="step === 'plan'" class="plan-section">
        <div class="period-toggle">
          <button :class="{ active: period === 'monthly' }" @click="period = 'monthly'">月付</button>
          <button :class="{ active: period === 'yearly' }" @click="period = 'yearly'">
            年付
            <span class="save-badge">省 17%</span>
          </button>
        </div>

        <div class="plan-card" :class="{ 'plan-card--selected': true }">
          <div class="plan-header">
            <span class="plan-name">Nexus Pro</span>
            <span class="plan-price">{{ currentPlan.label }}</span>
          </div>
          <ul class="plan-features">
            <li>无限交易处理</li>
            <li>高级分析报表</li>
            <li>优先技术支持</li>
            <li>自定义品牌样式</li>
          </ul>
        </div>

        <button class="btn-pay" @click="selectPlan">继续支付</button>
      </div>

      <!-- Step 2: Payment -->
      <div v-if="step === 'payment'" class="payment-section">
        <div class="order-summary">
          <span>{{ currentPlan.name }}</span>
          <span>{{ currentPlan.label }}</span>
        </div>

        <div class="field-group">
          <label class="field-label">支付方式</label>
          <NexusPaymentElement :options="{ layout: 'tabs' }" @change="onChange" />
        </div>

        <button class="btn-pay" :disabled="!complete || loading" @click="handleSubscribe">
          {{ loading ? '处理中...' : `订阅 ${currentPlan.label}` }}
        </button>

        <button class="btn-back" @click="backToPlans">&larr; 返回套餐选择</button>

        <div
          v-if="result && result.type === 'error'"
          class="result-box result-box--error"
        >
          {{ result.message }}
        </div>

        <div class="test-hint">
          <p>测试卡号：4242 4242 4242 4242（成功）· 4000 0000 0000 0002（拒绝）</p>
        </div>
      </div>

      <!-- Step 3: Success -->
      <div v-if="step === 'success'" class="success-section">
        <div class="success-icon">&#10003;</div>
        <h2>订阅成功</h2>
        <p class="success-detail">{{ result?.message }}</p>
        <p class="success-note">支付方式已保存，后续将自动续费。您可随时取消订阅。</p>
        <button class="btn-back" @click="backToPlans">返回套餐选择</button>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.period-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 4px;
}

.period-toggle button {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.period-toggle button.active {
  background: #fff;
  color: #1f2937;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.save-badge {
  font-size: 10px;
  background: #ecfdf5;
  color: #059669;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
}

.plan-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.plan-card--selected {
  border-color: #635bff;
  background: #f8f7ff;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plan-name {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.plan-price {
  font-size: 15px;
  font-weight: 600;
  color: #635bff;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.plan-features li {
  font-size: 13px;
  color: #4b5563;
  padding: 3px 0;
}

.plan-features li::before {
  content: '✓ ';
  color: #059669;
  font-weight: 700;
}

.order-summary {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.btn-back {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.15s;
}

.btn-back:hover {
  background: #f9fafb;
}

.success-section {
  text-align: center;
  padding: 24px 0;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #059669;
  color: #fff;
  font-size: 28px;
  line-height: 56px;
  margin: 0 auto 16px;
}

.success-section h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #1f2937;
}

.success-detail {
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 8px;
}

.success-note {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 20px;
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
</style>
