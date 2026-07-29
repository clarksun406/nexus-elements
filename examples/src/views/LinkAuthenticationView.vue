<script setup lang="ts">
import { ref } from 'vue'
import { NexusElements, NexusLinkAuthenticationElement } from '@nexus-elements/vue'
import type { ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const lastChange = ref<ChangeEvent | null>(null)

function onChange(event: unknown) {
  lastChange.value = event as ChangeEvent
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Link Authentication</h1>
      <p class="subtitle">OTP 快捷登录 — 手机号/邮箱 + 6 位验证码</p>

      <div class="field-group">
        <label class="field-label">登录方式</label>
        <NexusLinkAuthenticationElement :options="{ mode: 'phone' }" @change="onChange" />
      </div>

      <div v-if="lastChange" class="result-box" :class="{ 'result-box--success': lastChange.complete }">
        <p>complete: {{ lastChange.complete }} · valid: {{ lastChange.valid }} · empty: {{ lastChange.empty }}</p>
        <pre v-if="lastChange.value" class="value-dump">{{ JSON.stringify(lastChange.value, null, 2) }}</pre>
      </div>

      <div class="test-hint">
        <p>输入任意有效手机号/邮箱 → 点击发送 → 输入任意 6 位数字 → 验证成功</p>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.value-dump {
  margin-top: 8px;
  font-size: 11px;
  background: #f9fafb;
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
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
