<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const sessionId = computed(() => (route.query.session_id as string) ?? '')
</script>

<template>
  <div class="payment-card">
    <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>

    <div class="success-content">
      <div class="success-icon">&#10003;</div>
      <h1>支付成功</h1>
      <p class="subtitle">Redirect Checkout 完成 — 已从托管页返回</p>

      <div v-if="sessionId" class="result-box result-box--success">
        <p>会话 ID: {{ sessionId }}</p>
        <p>状态: complete</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.success-content {
  text-align: center;
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

.loading {
  text-align: center;
  padding: 32px;
  color: #9ca3af;
}
</style>
