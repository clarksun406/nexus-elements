<script setup lang="ts">
import { ref, computed } from 'vue'
import { bridge } from '../bridge'

interface CartItem {
  id: string
  name: string
  description?: string
  unit_amount: number
  currency: string
  quantity: number
}

interface TimelineEvent {
  status: string
  timestamp: string
  description?: string
}

const options = ref<Record<string, unknown>>({})
const orderId = ref('')
const status = ref<string>('pending')
const items = ref<CartItem[]>([])
const shippingAddress = ref<{
  name?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
}>({})
const paymentMethod = ref<{
  type?: string
  card?: {
    brand?: string
    last4?: string
    exp_month?: number
    exp_year?: number
  }
}>({})
const timeline = ref<TimelineEvent[]>([])

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CNY: '¥', JPY: '¥',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: '待处理', color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  processing: { label: '处理中', color: '#2563eb', bg: '#eff6ff', icon: '⚙️' },
  paid: { label: '已支付', color: '#059669', bg: '#ecfdf5', icon: '✓' },
  failed: { label: '支付失败', color: '#dc2626', bg: '#fef2f2', icon: '✗' },
  cancelled: { label: '已取消', color: '#6b7280', bg: '#f9fafb', icon: '⊘' },
  refunded: { label: '已退款', color: '#7c3aed', bg: '#f5f3ff', icon: '↩' },
}

const currency = computed(() => {
  return items.value[0]?.currency?.toUpperCase() ?? 'USD'
})

function formatPrice(cents: number): string {
  const sym = CURRENCY_SYMBOLS[currency.value] ?? currency.value + ' '
  if (currency.value === 'JPY') return sym + Math.round(cents / 100)
  return sym + (cents / 100).toFixed(2)
}

const subtotal = computed(() => items.value.reduce((sum, item) => sum + item.unit_amount * item.quantity, 0))

interface StatusDisplay { label: string; color: string; bg: string; icon: string }

const statusConfig = computed((): StatusDisplay => (STATUS_CONFIG[status.value] ?? STATUS_CONFIG.pending) as StatusDisplay)

function getStatusConfig(statusKey: string): StatusDisplay {
  return (STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending) as StatusDisplay
}

const formattedAddress = computed(() => {
  const addr = shippingAddress.value.address
  if (!addr) return ''
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ].filter(Boolean)
  return parts.join(', ')
})

const cardBrandLabel = computed(() => {
  const brand = paymentMethod.value.card?.brand
  if (!brand) return ''
  return brand.charAt(0).toUpperCase() + brand.slice(1)
})

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return timestamp
  }
}

const isEmpty = computed(() => !orderId.value && items.value.length === 0)

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  orderId.value = (options.value.orderId as string) ?? ''

  const defaults = options.value.defaultValues as Record<string, unknown> | undefined
  if (defaults) {
    status.value = (defaults.status as string) ?? 'pending'

    if (Array.isArray(defaults.items)) {
      items.value = defaults.items as CartItem[]
    }

    if (defaults.shippingAddress) {
      shippingAddress.value = defaults.shippingAddress as typeof shippingAddress.value
    }

    if (defaults.paymentMethod) {
      paymentMethod.value = defaults.paymentMethod as typeof paymentMethod.value
    }

    if (Array.isArray(defaults.timeline)) {
      timeline.value = defaults.timeline as TimelineEvent[]
    }
  }

  bridge.send('nexus:ready', { elementType: 'order' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }

  if (payload.options.orderId !== undefined) {
    orderId.value = payload.options.orderId as string
  }

  const defaults = payload.options.defaultValues as Record<string, unknown> | undefined
  if (defaults) {
    if (defaults.status) status.value = defaults.status as string
    if (Array.isArray(defaults.items)) items.value = defaults.items as CartItem[]
    if (defaults.shippingAddress) shippingAddress.value = defaults.shippingAddress as typeof shippingAddress.value
    if (defaults.paymentMethod) paymentMethod.value = defaults.paymentMethod as typeof paymentMethod.value
    if (Array.isArray(defaults.timeline)) timeline.value = defaults.timeline as TimelineEvent[]
  }
})

bridge.on('nexus:clear', () => {
  orderId.value = ''
  status.value = 'pending'
  items.value = []
  shippingAddress.value = {}
  paymentMethod.value = {}
  timeline.value = []
})
</script>

<template>
  <div class="nexus-order">
    <div v-if="isEmpty" class="nexus-order-empty">
      <p class="nexus-order-empty-text">暂无订单信息</p>
      <p class="nexus-order-empty-sub">No order information available</p>
    </div>

    <template v-else>
      <div class="nexus-order-header">
        <div class="nexus-order-id">
          <span class="nexus-order-id-label">订单号</span>
          <span class="nexus-order-id-value">{{ orderId || '—' }}</span>
        </div>
        <div class="nexus-order-status" :style="{ color: statusConfig.color, background: statusConfig.bg }">
          <span class="nexus-order-status-icon">{{ statusConfig.icon }}</span>
          <span>{{ statusConfig.label }}</span>
        </div>
      </div>

      <div v-if="items.length > 0" class="nexus-order-section">
        <h3 class="nexus-order-section-title">商品详情</h3>
        <div class="nexus-order-items">
          <div v-for="item in items" :key="item.id" class="nexus-order-item">
            <div class="nexus-order-item-info">
              <span class="nexus-order-item-name">{{ item.name }}</span>
              <span v-if="item.description" class="nexus-order-item-desc">{{ item.description }}</span>
              <span class="nexus-order-item-qty">x{{ item.quantity }}</span>
            </div>
            <span class="nexus-order-item-price">{{ formatPrice(item.unit_amount * item.quantity) }}</span>
          </div>
        </div>
        <div class="nexus-order-subtotal">
          <span>小计</span>
          <span>{{ formatPrice(subtotal) }}</span>
        </div>
      </div>

      <div v-if="paymentMethod.type" class="nexus-order-section">
        <h3 class="nexus-order-section-title">支付方式</h3>
        <div class="nexus-order-payment">
          <template v-if="paymentMethod.type === 'card' && paymentMethod.card">
            <span class="nexus-order-card-brand">{{ cardBrandLabel }}</span>
            <span class="nexus-order-card-last4">**** {{ paymentMethod.card.last4 }}</span>
            <span v-if="paymentMethod.card.exp_month" class="nexus-order-card-exp">
              {{ String(paymentMethod.card.exp_month).padStart(2, '0') }}/{{ paymentMethod.card.exp_year }}
            </span>
          </template>
          <template v-else>
            <span>{{ paymentMethod.type }}</span>
          </template>
        </div>
      </div>

      <div v-if="formattedAddress" class="nexus-order-section">
        <h3 class="nexus-order-section-title">收货地址</h3>
        <div class="nexus-order-address">
          <p v-if="shippingAddress.name" class="nexus-order-address-name">{{ shippingAddress.name }}</p>
          <p v-if="shippingAddress.phone" class="nexus-order-address-phone">{{ shippingAddress.phone }}</p>
          <p class="nexus-order-address-line">{{ formattedAddress }}</p>
        </div>
      </div>

      <div v-if="timeline.length > 0" class="nexus-order-section">
        <h3 class="nexus-order-section-title">订单时间线</h3>
        <div class="nexus-order-timeline">
          <div v-for="(event, index) in timeline" :key="index" class="nexus-order-timeline-item">
            <div class="nexus-order-timeline-dot" :style="{ borderColor: getStatusConfig(event.status).color }">
            </div>
            <div v-if="index < timeline.length - 1" class="nexus-order-timeline-line"></div>
            <div class="nexus-order-timeline-content">
              <span class="nexus-order-timeline-status" :style="{ color: getStatusConfig(event.status).color }">
                {{ getStatusConfig(event.status).label }}
              </span>
              <span class="nexus-order-timeline-time">{{ formatDate(event.timestamp) }}</span>
              <span v-if="event.description" class="nexus-order-timeline-desc">{{ event.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nexus-order {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2937;
  font-size: 13px;
  padding: 16px;
}

.nexus-order-empty {
  text-align: center;
  padding: 40px 20px;
}

.nexus-order-empty-text {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.nexus-order-empty-sub {
  font-size: 12px;
  color: #9ca3af;
}

.nexus-order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 12px;
}

.nexus-order-id-label {
  font-size: 11px;
  color: #9ca3af;
  display: block;
  margin-bottom: 2px;
}

.nexus-order-id-value {
  font-size: 13px;
  font-weight: 600;
  font-family: 'SF Mono', Monaco, monospace;
}

.nexus-order-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.nexus-order-status-icon {
  font-size: 12px;
}

.nexus-order-section {
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}

.nexus-order-section:last-child {
  border-bottom: none;
}

.nexus-order-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.nexus-order-items {
  margin-bottom: 8px;
}

.nexus-order-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 0;
}

.nexus-order-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nexus-order-item-name {
  font-weight: 500;
  font-size: 13px;
}

.nexus-order-item-desc {
  font-size: 11px;
  color: #6b7280;
}

.nexus-order-item-qty {
  font-size: 11px;
  color: #9ca3af;
}

.nexus-order-item-price {
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.nexus-order-subtotal {
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
  font-size: 13px;
  font-weight: 600;
}

.nexus-order-payment {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.nexus-order-card-brand {
  font-weight: 600;
}

.nexus-order-card-last4 {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.nexus-order-card-exp {
  font-size: 12px;
  color: #6b7280;
}

.nexus-order-address-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.nexus-order-address-phone {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.nexus-order-address-line {
  font-size: 13px;
  line-height: 1.4;
}

.nexus-order-timeline {
  position: relative;
  padding-left: 16px;
}

.nexus-order-timeline-item {
  position: relative;
  padding-bottom: 16px;
  padding-left: 12px;
}

.nexus-order-timeline-item:last-child {
  padding-bottom: 0;
}

.nexus-order-timeline-dot {
  position: absolute;
  left: -16px;
  top: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid;
  background: #fff;
}

.nexus-order-timeline-line {
  position: absolute;
  left: -12px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.nexus-order-timeline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nexus-order-timeline-status {
  font-weight: 600;
  font-size: 13px;
}

.nexus-order-timeline-time {
  font-size: 11px;
  color: #9ca3af;
}

.nexus-order-timeline-desc {
  font-size: 12px;
  color: #6b7280;
}
</style>
