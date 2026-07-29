<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NexusElements, NexusPaymentElement } from '@nexus-elements/vue'
import type { Nexus, NexusElements as NexusElementsInstance, ChangeEvent, SavedPaymentMethod } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const layout = ref<'tabs' | 'accordion' | 'radio'>('tabs')
const currency = ref('CNY')
const amount = ref(9900)
const complete = ref(false)
const loading = ref(false)
const paymentMethodType = ref('card')
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const showSaved = ref(false)
const collectEmail = ref(false)
const savedMethods = ref<SavedPaymentMethod[]>([])

const elementOptions = computed(() => ({
  layout: layout.value,
  business: { name: 'Nexus Demo Store', amount: amount.value, currency: currency.value },
  savedPaymentMethods: showSaved.value ? savedMethods.value.map((pm) => ({ ...pm })) : undefined,
  fields: collectEmail.value ? { billingDetails: { email: 'required' as const } } : undefined,
  defaultValues: { billingDetails: { name: 'Nexus Demo User' } },
}))

onMounted(async () => {
  try {
    const res = await fetch('/v1/payment_methods', { headers: { 'X-Nexus-Key': PUBLISHABLE_KEY } })
    const data = await res.json()
    savedMethods.value = (data.data ?? []).map((pm: { id: string; card: { brand: string; last4: string; exp_month: number; exp_year: number } }) => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    }))
  } catch {
    savedMethods.value = []
  }
})

let nexus: Nexus | null = null
let elements: NexusElementsInstance | null = null

const amounts = [
  { label: '¥99', value: 9900 },
  { label: '¥199', value: 19900 },
  { label: '¥499', value: 49900 },
]

const currencies = ['CNY', 'USD', 'EUR']

function onReady(nexusInstance: Nexus, elementsInstance: NexusElementsInstance) {
  nexus = nexusInstance
  elements = elementsInstance
}

function onChange(event: unknown) {
  const e = event as ChangeEvent
  complete.value = e.complete
  if (e.paymentMethodType) paymentMethodType.value = e.paymentMethodType
}

async function handlePay() {
  if (!nexus || !elements) {
    result.value = { type: 'error', message: 'Elements 未就绪' }
    return
  }

  loading.value = true
  result.value = null

  try {
    const intentRes = await fetch('/v1/payment_intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PUBLISHABLE_KEY },
      body: JSON.stringify({
        amount: amount.value,
        currency: currency.value.toLowerCase(),
        description: 'Nexus Demo 订单（Payment Element）',
        payment_method_types: ['card', 'ideal'],
      }),
    })
    const intentData = await intentRes.json()
    if (!intentRes.ok) {
      result.value = { type: 'error', message: intentData.error?.message ?? '创建支付失败' }
      return
    }

    const { error, paymentIntent } = await nexus.confirmPayment({
      elements,
      clientSecret: intentData.payment_intent.client_secret,
      confirmParams: {
        return_url: window.location.origin + window.location.pathname,
      },
    })

    if (error) {
      result.value = { type: 'error', message: error.message }
    } else if (paymentIntent?.status === 'succeeded') {
      result.value = {
        type: 'success',
        message: `支付成功！${paymentIntent.id} · ${paymentMethodType.value} · ${currency.value} ${(amount.value / 100).toFixed(2)} — layout: ${layout.value}`,
      }
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
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html" @ready="onReady">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Payment Element</h1>
      <p class="subtitle">聚合支付组件 — 布局切换 / 币种 / 金额档位</p>

      <div class="amount-display">{{ currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '€' }}{{ (amount / 100).toFixed(2) }}</div>

      <div class="chip-row">
        <button
          v-for="c in currencies"
          :key="c"
          class="chip"
          :class="{ 'chip--active': currency === c }"
          @click="currency = c"
        >
          {{ c }}
        </button>
      </div>

      <div class="chip-row">
        <button
          v-for="a in amounts"
          :key="a.value"
          class="chip"
          :class="{ 'chip--active': amount === a.value }"
          @click="amount = a.value"
        >
          {{ a.label }}
        </button>
      </div>

      <div class="chip-row">
        <button
          v-for="l in (['tabs', 'accordion', 'radio'] as const)"
          :key="l"
          class="chip"
          :class="{ 'chip--active': layout === l }"
          @click="layout = l"
        >
          {{ l }}
        </button>
      </div>

      <div class="chip-row">
        <button class="chip" :class="{ 'chip--active': showSaved }" @click="showSaved = !showSaved">已保存卡</button>
        <button class="chip" :class="{ 'chip--active': collectEmail }" @click="collectEmail = !collectEmail">收集邮箱</button>
      </div>

      <div class="field-group">
        <NexusPaymentElement :options="elementOptions" @change="onChange" />
      </div>

      <button class="btn-pay" :disabled="!complete || loading" @click="handlePay">
        {{ loading ? '处理中...' : '立即支付' }}
      </button>

      <div v-if="result" class="result-box" :class="result.type === 'success' ? 'result-box--success' : 'result-box--error'">
        {{ result.message }}
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.chip-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
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
