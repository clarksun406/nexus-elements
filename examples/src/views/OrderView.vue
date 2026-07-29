<script setup lang="ts">
import { ref, computed } from 'vue'
import { NexusElements, NexusOrderElement } from '@nexus-elements/vue'
import type { OrderStatus } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

const currentStatus = ref<OrderStatus>('processing')

const orderOptions = computed(() => ({
  orderId: 'ord_' + 'NX' + Date.now().toString(36).toUpperCase(),
  defaultValues: {
    status: currentStatus.value,
    items: [
      { id: 'prod_1', name: 'Nexus Pro 年度订阅', description: '高级版功能', unit_amount: 9900, currency: 'CNY', quantity: 1 },
      { id: 'prod_2', name: '无线蓝牙耳机', description: '主动降噪', unit_amount: 4900, currency: 'CNY', quantity: 2 },
    ],
    shippingAddress: {
      name: '张三',
      phone: '138****1234',
      address: {
        line1: '科技园南路88号',
        city: '深圳市',
        state: '广东省',
        postal_code: '518000',
        country: 'CN',
      },
    },
    paymentMethod: {
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2028,
      },
    },
    timeline: generateTimeline(currentStatus.value),
  },
}))

function generateTimeline(status: OrderStatus) {
  const now = new Date()
  const events: Array<{ status: string; timestamp: string; description?: string }> = [
    { status: 'pending', timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(), description: '订单已创建' },
    { status: 'processing', timestamp: new Date(now.getTime() - 3600000).toISOString(), description: '正在处理支付' },
  ]

  if (status === 'paid' || status === 'refunded') {
    events.push({ status: 'paid', timestamp: new Date(now.getTime() - 1800000).toISOString(), description: '支付成功' })
  }
  if (status === 'failed') {
    events.push({ status: 'failed', timestamp: new Date(now.getTime() - 1800000).toISOString(), description: '支付被拒绝' })
  }
  if (status === 'cancelled') {
    events.push({ status: 'cancelled', timestamp: new Date(now.getTime() - 1800000).toISOString(), description: '订单已取消' })
  }
  if (status === 'refunded') {
    events.push({ status: 'refunded', timestamp: now.toISOString(), description: '已退款至原支付方式' })
  }

  return events
}

const statuses: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'paid', label: '已支付' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
  { value: 'refunded', label: '已退款' },
]
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>Order Element</h1>
      <p class="subtitle">订单详情组件 — 状态 / 商品 / 支付方式 / 地址 / 时间线</p>

      <div class="status-controls">
        <label class="status-label">切换订单状态：</label>
        <div class="status-buttons">
          <button
            v-for="s in statuses"
            :key="s.value"
            class="status-btn"
            :class="{ active: currentStatus === s.value }"
            @click="currentStatus = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="order-wrapper">
        <NexusOrderElement :key="currentStatus" :options="orderOptions" />
      </div>

      <div class="test-hint">
        <p><strong>测试提示：</strong></p>
        <ul>
          <li>点击上方按钮切换不同订单状态</li>
          <li>查看状态徽章、时间线的变化</li>
          <li>每个状态展示不同的时间线事件</li>
        </ul>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.status-controls {
  margin-bottom: 16px;
}

.status-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
}

.status-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.status-btn {
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.status-btn:hover {
  border-color: #635bff;
}

.status-btn.active {
  background: #635bff;
  color: #fff;
  border-color: #635bff;
}

.order-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
}

.test-hint {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #6b7280;
}

.test-hint p {
  font-weight: 600;
  margin-bottom: 6px;
}

.test-hint ul {
  padding-left: 18px;
}

.test-hint li {
  margin-bottom: 3px;
}
</style>
