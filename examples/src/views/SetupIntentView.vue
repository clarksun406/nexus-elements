<script setup lang="ts">
import { ref } from 'vue'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'
import type { Nexus, NexusElements as NexusElementsInstance, ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const complete = ref(false)
const loading = ref(false)
const result = ref<{ type: 'success' | 'error'; message: string } | null>(null)

let nexus: Nexus | null = null
let elements: NexusElementsInstance | null = null

function onReady(nexusInstance: Nexus, elementsInstance: NexusElementsInstance) {
  nexus = nexusInstance
  elements = elementsInstance
}

function onChange(event: unknown) {
  complete.value = (event as ChangeEvent).complete
}

async function handleSave() {
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
      body: JSON.stringify({ usage: 'off_session' }),
    })
    const setupData = await setupRes.json()
    if (!setupRes.ok) {
      result.value = { type: 'error', message: setupData.error?.message ?? '创建 SetupIntent 失败' }
      return
    }

    const { error, setupIntent } = await nexus.confirmSetup({
      elements,
      clientSecret: setupData.setup_intent.client_secret,
      confirmParams: { return_url: window.location.origin + window.location.pathname },
    })

    if (error) {
      result.value = { type: 'error', message: error.message }
    } else if (setupIntent?.status === 'succeeded') {
      result.value = { type: 'success', message: `卡片保存成功！${setupIntent.id} · 可用于后续免密扣款` }
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
      <h1>保存卡片</h1>
      <p class="subtitle">Setup Intent — confirmSetup 保存支付方式（不扣款）</p>

      <div class="field-group">
        <label class="field-label">银行卡信息</label>
        <NexusCardElement :options="{ showIcon: true }" @change="onChange" />
      </div>

      <button class="btn-pay" :disabled="!complete || loading" @click="handleSave">
        {{ loading ? '保存中...' : '保存卡片' }}
      </button>

      <div
        v-if="result"
        class="result-box"
        :class="{ 'result-box--success': result.type === 'success', 'result-box--error': result.type === 'error' }"
      >
        {{ result.message }}
      </div>

      <div class="test-hint">
        <p>测试卡号：4242 4242 4242 4242（成功）· 4000 0000 0000 0002（拒绝）</p>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
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
