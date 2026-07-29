<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'

interface CartItem {
  id: string
  name: string
  description?: string
  image?: string
  unit_amount: number
  currency: string
  quantity: number
}

interface ShippingOption {
  id: string
  displayName: string
  amount: number
}

const options = ref<Record<string, unknown>>({})
const items = ref<CartItem[]>([])
const promoCode = ref('')
const appliedPromo = ref<{ code: string; discount: number; message?: string } | null>(null)
const promoError = ref('')
const selectedShipping = ref<string>('')
const focused = ref(false)

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CNY: '¥', JPY: '¥',
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

const shippingOptions = computed<ShippingOption[]>(() => {
  const opts = options.value.shippingOptions
  return Array.isArray(opts) ? (opts as ShippingOption[]) : []
})

const shippingAmount = computed(() => {
  const opts = shippingOptions.value
  if (opts.length === 0) return 0
  const selected = opts.find((o) => o.id === selectedShipping.value)
  return selected?.amount ?? opts[0]?.amount ?? 0
})

const taxAmount = computed(() => Number(options.value.taxAmount) || 0)
const discount = computed(() => appliedPromo.value?.discount ?? 0)
const total = computed(() => Math.max(0, subtotal.value + shippingAmount.value + taxAmount.value - discount.value))
const isEmpty = computed(() => items.value.length === 0)
const isComplete = computed(() => items.value.length > 0)

const allowPromoCodes = computed(() => !!options.value.allowPromoCodes)

watch([isComplete, isEmpty, total], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isComplete.value,
    elementType: 'cart',
    value: {
      items: items.value,
      subtotal: subtotal.value,
      shipping: shippingAmount.value,
      tax: taxAmount.value,
      discount: discount.value,
      total: total.value,
      promoCode: appliedPromo.value?.code,
    },
  })
})

function updateQuantity(itemId: string, delta: number) {
  const item = items.value.find((i) => i.id === itemId)
  if (!item) return
  const newQty = item.quantity + delta
  if (newQty <= 0) {
    removeItem(itemId)
    return
  }
  item.quantity = newQty
}

function removeItem(itemId: string) {
  items.value = items.value.filter((i) => i.id !== itemId)
}

function applyPromo() {
  const code = promoCode.value.trim()
  if (!code) return
  promoError.value = ''

  const mockPromos: Record<string, { discount: number; message: string }> = {
    NEXUS10: { discount: Math.round(subtotal.value * 0.1), message: '9折优惠' },
    SAVE20: { discount: 2000, message: '立减 ¥20.00' },
    FREESHIP: { discount: shippingAmount.value, message: '免运费' },
  }

  const result = mockPromos[code.toUpperCase()]
  if (result) {
    appliedPromo.value = { code: code.toUpperCase(), discount: result.discount, message: result.message }
    promoCode.value = ''
  } else {
    promoError.value = '无效的优惠码'
  }
}

function removePromo() {
  appliedPromo.value = null
}

function selectShipping(optionId: string) {
  selectedShipping.value = optionId
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}

  const initItems = options.value.items
  if (Array.isArray(initItems)) {
    items.value = initItems as CartItem[]
  }

  const defaultPromo = options.value.defaultPromoCode as string | undefined
  if (defaultPromo) {
    promoCode.value = defaultPromo
    applyPromo()
  }

  const shippingOpts = shippingOptions.value
  if (shippingOpts.length > 0) {
    selectedShipping.value = shippingOpts[0]?.id ?? ''
  }

  bridge.send('nexus:ready', { elementType: 'cart' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }

  const newItems = payload.options.items
  if (Array.isArray(newItems)) {
    items.value = newItems as CartItem[]
  }
})

bridge.on('nexus:focus', () => {
  focused.value = true
})

bridge.on('nexus:blur', () => {
  focused.value = false
})

bridge.on('nexus:clear', () => {
  items.value = []
  appliedPromo.value = null
  promoCode.value = ''
  promoError.value = ''
})
</script>

<template>
  <div class="nexus-cart" :class="{ 'nexus-cart--empty': isEmpty }">
    <div v-if="isEmpty" class="nexus-cart-empty">
      <div class="nexus-cart-empty-icon">🛒</div>
      <p class="nexus-cart-empty-text">购物车为空</p>
      <p class="nexus-cart-empty-sub">Your cart is empty</p>
    </div>

    <template v-else>
      <div class="nexus-cart-items">
        <div v-for="item in items" :key="item.id" class="nexus-cart-item">
          <div class="nexus-cart-item-image">
            <img v-if="item.image" :src="item.image" :alt="item.name" />
            <div v-else class="nexus-cart-item-placeholder">{{ item.name.charAt(0) }}</div>
          </div>
          <div class="nexus-cart-item-details">
            <p class="nexus-cart-item-name">{{ item.name }}</p>
            <p v-if="item.description" class="nexus-cart-item-desc">{{ item.description }}</p>
            <p class="nexus-cart-item-price">{{ formatPrice(item.unit_amount) }}</p>
          </div>
          <div class="nexus-cart-item-qty">
            <button class="nexus-cart-qty-btn" aria-label="减少数量" @click="updateQuantity(item.id, -1)">−</button>
            <span class="nexus-cart-qty-value">{{ item.quantity }}</span>
            <button class="nexus-cart-qty-btn" aria-label="增加数量" @click="updateQuantity(item.id, 1)">+</button>
          </div>
          <div class="nexus-cart-item-total">
            {{ formatPrice(item.unit_amount * item.quantity) }}
          </div>
          <button class="nexus-cart-item-remove" aria-label="删除商品" @click="removeItem(item.id)" title="删除">&times;</button>
        </div>
      </div>

      <div v-if="shippingOptions.length > 0" class="nexus-cart-section">
        <p class="nexus-cart-section-title">配送方式</p>
        <div v-for="opt in shippingOptions" :key="opt.id" class="nexus-cart-shipping-option" :class="{ active: selectedShipping === opt.id }" role="radio" :aria-checked="selectedShipping === opt.id" tabindex="0" @click="selectShipping(opt.id)" @keydown.enter.prevent="selectShipping(opt.id)" @keydown.space.prevent="selectShipping(opt.id)">
          <span>{{ opt.displayName }}</span>
          <span>{{ opt.amount === 0 ? '免费' : formatPrice(opt.amount) }}</span>
        </div>
      </div>

      <div v-if="allowPromoCodes" class="nexus-cart-section">
        <p class="nexus-cart-section-title">优惠码</p>
        <div v-if="appliedPromo" class="nexus-cart-promo-applied">
          <span class="nexus-cart-promo-code">{{ appliedPromo.code }}</span>
          <span class="nexus-cart-promo-msg">{{ appliedPromo.message }}</span>
          <button class="nexus-cart-promo-remove" aria-label="移除优惠码" @click="removePromo">&times;</button>
        </div>
        <div v-else class="nexus-cart-promo-input">
          <input v-model="promoCode" type="text" placeholder="输入优惠码" aria-label="优惠码" class="nexus-cart-promo-field" @keyup.enter="applyPromo" />
          <button class="nexus-cart-promo-btn" @click="applyPromo">应用</button>
        </div>
        <p v-if="promoError" class="nexus-cart-promo-error" role="alert">{{ promoError }}</p>
      </div>

      <div class="nexus-cart-summary">
        <div class="nexus-cart-summary-row">
          <span>小计</span>
          <span>{{ formatPrice(subtotal) }}</span>
        </div>
        <div v-if="shippingAmount > 0" class="nexus-cart-summary-row">
          <span>运费</span>
          <span>{{ formatPrice(shippingAmount) }}</span>
        </div>
        <div v-if="taxAmount > 0" class="nexus-cart-summary-row">
          <span>税费</span>
          <span>{{ formatPrice(taxAmount) }}</span>
        </div>
        <div v-if="discount > 0" class="nexus-cart-summary-row nexus-cart-discount">
          <span>优惠</span>
          <span>-{{ formatPrice(discount) }}</span>
        </div>
        <div class="nexus-cart-summary-row nexus-cart-total">
          <span>合计</span>
          <span>{{ formatPrice(total) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nexus-cart {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2937;
  font-size: 13px;
  padding: 16px;
}

.nexus-cart-empty {
  text-align: center;
  padding: 40px 20px;
}

.nexus-cart-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.nexus-cart-empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.nexus-cart-empty-sub {
  font-size: 13px;
  color: #9ca3af;
}

.nexus-cart-items {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 12px;
  margin-bottom: 12px;
}

.nexus-cart-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.nexus-cart-item:last-child {
  border-bottom: none;
}

.nexus-cart-item-image {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nexus-cart-item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nexus-cart-item-placeholder {
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
}

.nexus-cart-item-details {
  flex: 1;
  min-width: 0;
}

.nexus-cart-item-name {
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nexus-cart-item-desc {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.nexus-cart-item-price {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.nexus-cart-item-qty {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.nexus-cart-qty-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  transition: all 0.15s;
}

.nexus-cart-qty-btn:hover {
  border-color: #635bff;
  color: #635bff;
}

.nexus-cart-qty-value {
  font-size: 13px;
  font-weight: 500;
  min-width: 20px;
  text-align: center;
}

.nexus-cart-item-total {
  font-weight: 600;
  font-size: 13px;
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.nexus-cart-item-remove {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}

.nexus-cart-item-remove:hover {
  color: #ef4444;
}

.nexus-cart-section {
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
}

.nexus-cart-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.nexus-cart-shipping-option {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.nexus-cart-shipping-option:hover {
  border-color: #635bff;
}

.nexus-cart-shipping-option.active {
  border-color: #635bff;
  background: #f8f7ff;
}

.nexus-cart-promo-input {
  display: flex;
  gap: 6px;
}

.nexus-cart-promo-field {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}

.nexus-cart-promo-field:focus {
  border-color: #635bff;
}

.nexus-cart-promo-btn {
  padding: 6px 12px;
  background: #635bff;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.nexus-cart-promo-btn:hover {
  background: #5046e5;
}

.nexus-cart-promo-applied {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  font-size: 12px;
}

.nexus-cart-promo-code {
  font-weight: 600;
  color: #059669;
}

.nexus-cart-promo-msg {
  color: #047857;
  flex: 1;
}

.nexus-cart-promo-remove {
  background: none;
  border: none;
  color: #059669;
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
}

.nexus-cart-promo-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: 4px;
}

.nexus-cart-summary {
  padding-top: 12px;
}

.nexus-cart-summary-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: #6b7280;
}

.nexus-cart-discount {
  color: #059669;
}

.nexus-cart-total {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  margin-top: 4px;
}
</style>
