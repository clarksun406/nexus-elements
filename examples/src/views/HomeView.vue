<script setup lang="ts">
interface DemoItem {
  name: string
  path: string
  description: string
  status: 'ready' | 'todo'
}

const demos: DemoItem[] = [
  { name: '合并卡片 Card Element', path: '/card-combined', description: '单一合并字段：卡号 + 有效期 + CVC', status: 'ready' },
  { name: '拆分卡片 Split Card', path: '/card-split', description: '独立三字段：cardNumber / cardExpiry / cardCvc', status: 'ready' },
  { name: 'Payment Element', path: '/payment-element', description: '聚合支付组件：多支付方式 + 布局切换', status: 'ready' },
  { name: '快捷支付 Express Checkout', path: '/express-checkout', description: 'Apple Pay / Google Pay / PayPal 按钮', status: 'ready' },
  { name: '嵌入式结账 Embedded Checkout', path: '/embedded-checkout', description: '托管结账页内嵌', status: 'ready' },
  { name: '重定向结账 Redirect Checkout', path: '/redirect-checkout', description: '跳转托管结账页', status: 'ready' },
  { name: '订阅支付 Billing', path: '/billing', description: 'Subscription + Payment Element', status: 'ready' },
  { name: '保存卡片 Setup Intent', path: '/setup-intent', description: 'SetupIntent 保存支付方式', status: 'ready' },
  { name: '银行转账 Bank Transfer', path: '/bank-transfer', description: 'iDEAL / IBAN / BECS / FPX / EPS / P24', status: 'ready' },
  { name: '地址组件 Address Element', path: '/address', description: '地址收集 + 国家动态字段', status: 'ready' },
  { name: '分期消息 Payment Messaging', path: '/payment-messaging', description: 'BNPL 分期信息展示', status: 'ready' },
  { name: 'Link 快捷登录', path: '/link-authentication', description: 'OTP 手机号/邮箱验证', status: 'ready' },
  { name: '购物车 Cart Element', path: '/cart', description: '商品列表 / 数量编辑 / 优惠码', status: 'ready' },
  { name: '订单详情 Order Element', path: '/order', description: '订单状态 / 商品 / 时间线', status: 'ready' },
  { name: 'Afterpay/Clearpay', path: '/afterpay-clearpay', description: 'BNPL 4 期免息 · 地区品牌切换', status: 'ready' },
  { name: 'Wallet Button', path: '/wallet-button', description: '单钱包按钮 · 主题/类型切换', status: 'ready' },
]
</script>

<template>
  <div class="payment-card home-card">
    <h1>Nexus Elements</h1>
    <p class="subtitle">仿 Stripe Elements 支付组件库 — 示例集合</p>

    <div class="demo-grid">
      <router-link
        v-for="demo in demos"
        :key="demo.path"
        :to="demo.path"
        class="demo-item"
        :class="{ 'demo-item--disabled': demo.status === 'todo' }"
        :tabindex="demo.status === 'todo' ? -1 : 0"
      >
        <div class="demo-item-header">
          <span class="demo-name">{{ demo.name }}</span>
          <span class="demo-badge" :class="demo.status === 'ready' ? 'badge-ready' : 'badge-todo'">
            {{ demo.status === 'ready' ? 'READY' : 'TODO' }}
          </span>
        </div>
        <p class="demo-desc">{{ demo.description }}</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.home-card {
  max-width: 640px;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.demo-item {
  display: block;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.demo-item:hover {
  border-color: #635bff;
  box-shadow: 0 2px 8px rgba(99, 91, 255, 0.1);
}

.demo-item--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.demo-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.demo-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.demo-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.badge-ready {
  background: #ecfdf5;
  color: #059669;
}

.badge-todo {
  background: #f3f4f6;
  color: #9ca3af;
}

.demo-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
}

@media (max-width: 560px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
