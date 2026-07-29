<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusAddressElement } from '@nexus-elements/vue'
import type { ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const mode = ref<'shipping' | 'billing'>('shipping')
const lastChange = ref<ChangeEvent | null>(null)

const addressOptions = computed(() => ({
  mode: mode.value,
  fields: { phone: 'optional' as const },
  defaultValues: {
    name: '',
    address: { country: 'US' },
  },
}))

function onChange(event: unknown) {
  lastChange.value = event as ChangeEvent
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>地址组件</h1>
      <p class="subtitle">Address Element — 国家动态字段 + 邮编校验</p>

      <div class="mode-switch">
        <label><input v-model="mode" type="radio" value="shipping" /> 收货地址 shipping</label>
        <label><input v-model="mode" type="radio" value="billing" /> 账单地址 billing</label>
      </div>

      <div class="field-group">
        <label class="field-label">地址信息</label>
        <NexusAddressElement :key="mode" :options="addressOptions" @change="onChange" />
      </div>

      <div v-if="lastChange" class="result-box" :class="{ 'result-box--success': lastChange.complete }">
        <p>complete: {{ lastChange.complete }} · valid: {{ lastChange.valid }} · empty: {{ lastChange.empty }}</p>
        <pre class="value-dump">{{ JSON.stringify(lastChange.value, null, 2) }}</pre>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.mode-switch {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #4b5563;
}

.mode-switch label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.value-dump {
  margin-top: 8px;
  font-size: 11px;
  background: #f9fafb;
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
}
</style>
