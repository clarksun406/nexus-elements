# Nexus Elements — 集成指南

> 面向商户前端的接入手册，覆盖四种支付流程 + 3DS 处理。
> API 细节见 [api-reference.md](api-reference.md)，后端契约见 [backend-api.md](backend-api.md)。

---

## 1. 前置准备

### 1.1 安装

```bash
pnpm add @nexus-elements/core        # 框架无关 SDK
pnpm add @nexus-elements/vue         # Vue 3 适配层（可选）
```

### 1.2 后端

商户后端需实现 [backend-api.md](backend-api.md) 定义的接口，最少两个：

- `POST /v1/payment_intents` — 创建支付意图，返回 `client_secret`
- `POST /v1/payment_intents/confirm` — 确认支付（SDK 内部调用）

本仓库有两条实现，行为由 `packages/contracts` 钉在一起：

| 实现 | 用途 | 怎么跑 |
|------|------|--------|
| `packages/mock-api` | 示例站点默认后端，纯内存 | `pnpm dev` |
| `apps/server` | 可部署的 Fastify 服务，Postgres 或内存 | 见下 |

内存模式（不装数据库，密钥与示例站相同）：

```bash
pnpm --filter @nexus-elements/contracts build
pnpm --filter @nexus-elements/server build
STORE=memory PORT=3001 node apps/server/dist/index.js
```

Postgres：复制 `apps/server/.env.example`，或：

```bash
docker compose up --build
# API: http://127.0.0.1:3001/health
```

把示例站点指到真实后端（不再挂 mock 插件）：

```bash
NEXUS_API_TARGET=http://127.0.0.1:3001 pnpm --filter examples dev
```

服务端创建资源用 `Authorization: Bearer sk_test_...`。示例页仍用 `X-Nexus-Key: pk_test_nexus_example_key` 创建 Intent（`ALLOW_PUBLISHABLE_CREATES=true`）。生产环境设 `ALLOW_PUBLISHABLE_CREATES=false`，并且不要使用 `.env.example` 里的示例密钥。测试金字塔见 [testing.md](testing.md)。

### 1.3 Fields iframe 部署

敏感字段页面（`@nexus-elements/fields` 构建产物）需可被 iframe 加载：

```ts
nexus.setFieldsUrl('/fields/index.html')          // 开发：同源
nexus.setFieldsUrl('https://fields.yourpay.com')  // 生产：独立域（推荐，PCI 隔离）
```

Vue 下经 Provider 的 `fields-url` prop 传入。

### 1.4 CDN 加载（替代 npm 安装）

如果不使用构建工具，可通过 `<script>` 标签从 CDN 加载 SDK：

```html
<script src="https://js.nexuspay.com/v1/nexus.js"
        integrity="sha384-xxxx"
        crossorigin="anonymous"></script>
<script>
  const nexus = Nexus.createNexus('pk_test_xxx')
  const elements = nexus.elements()
  const card = elements.create('card')
  card.mount('#card-element')
</script>
```

也可以使用内置的加载器，自带去重、重试和 SRI 支持：

```html
<script>
  Nexus.loadScript({
    url: 'https://js.nexuspay.com/v1/nexus.js',
    integrity: 'sha384-xxxx',   // SRI 哈希（每次构建可通过 pnpm verify:bundle 获取）
    retries: 3,                                     // 失败重试次数（默认 3，指数退避）
  }).then(() => {
    const nexus = Nexus.createNexus('pk_test_xxx')
    // ...
  })
</script>
```

`loadScript` 行为：
- **去重**：若 `window.Nexus` 已存在或页面已有同 URL 的 `<script>`，直接复用
- **重试**：失败后指数退避重试（1s → 2s → 4s…），默认 3 次
- **SRI**：传入 `integrity` 时自动设置 `script.integrity` + `crossOrigin="anonymous"`

### 1.5 测试卡号

| 卡号 | 行为 |
|------|------|
| 4242 4242 4242 4242 | 成功 |
| 4000 0000 0000 0002 | 拒绝 card_declined |
| 4000 0000 0000 9995 | 余额不足 |
| 4000 0000 0000 3220 | 触发 3DS |
| 5555 5555 5555 4444 / 3782 822463 10005 | Mastercard / Amex 成功 |

任意未来有效期 + 任意 CVC 即可。全表见 [backend-api.md §8](backend-api.md)。

---

## 2. 流程一：合并卡（Card Element）

一个字段收齐卡号 + 有效期 + CVC，最简接入。

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { createNexus } from '@nexus-elements/core'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'
import type { ChangeEvent, NexusElement } from '@nexus-elements/core'

const PK = 'pk_test_xxx'
const nexus = createNexus(PK)
const cardRef = ref<{ getElement: () => NexusElement | undefined } | null>(null)
const complete = ref(false)

function onChange(e: unknown) {
  complete.value = (e as ChangeEvent).complete   // 控制支付按钮可用性
}

async function pay() {
  // 1. 后端创建 PaymentIntent
  const res = await fetch('/v1/payment_intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': PK },
    body: JSON.stringify({ amount: 9900, currency: 'cny' }),
  })
  const { payment_intent } = await res.json()

  // 2. SDK 确认（内部：iframe tokenize → confirm）
  const { error, paymentIntent } = await nexus.confirmCardPayment(
    payment_intent.client_secret,
    {
      payment_method: { card: cardRef.value!.getElement()! },
      return_url: location.origin + location.pathname,   // 3DS 回跳
    },
  )

  if (error) { /* error.message / error.decline_code */ }
  else if (paymentIntent?.status === 'succeeded') { /* 成功 */ }
  else if (paymentIntent?.status === 'requires_action') { /* 正在跳转 3DS */ }
}
</script>

<template>
  <NexusElements :publishable-key="PK" fields-url="/fields/index.html"
                 :options="{ appearance: { theme: 'stripe' } }">
    <NexusCardElement ref="cardRef" :options="{ showIcon: true }" @change="onChange" />
    <button :disabled="!complete" @click="pay">支付</button>
  </NexusElements>
</template>
```

### 框架无关（原生 TS）

```ts
import { createNexus } from '@nexus-elements/core'

const nexus = createNexus('pk_test_xxx')
nexus.setFieldsUrl('/fields/index.html')

const elements = nexus.elements({ appearance: { theme: 'stripe' } })
const card = elements.create('card', { showIcon: true })
card.mount('#card-container')
card.on('change', (e) => { /* e.complete / e.brand / e.error */ })

// 支付时
const { error, paymentIntent } = await nexus.confirmCardPayment(clientSecret, {
  payment_method: { card },
  return_url: location.href,
})
```

---

## 3. 流程二：拆分卡（cardNumber + cardExpiry + cardCvc）

三个独立字段自由布局。**同一 `elements` 实例创建的三个字段自动成组**——confirm 时传任意一个（惯例传 cardNumber），SDK 自动跨 iframe 聚合三段数据。

```ts
const elements = nexus.elements()
const number = elements.create('cardNumber', { placeholder: '1234 1234 1234 1234' })
const expiry = elements.create('cardExpiry')
const cvc = elements.create('cardCvc')
number.mount('#number'); expiry.mount('#expiry'); cvc.mount('#cvc')

// 各自监听 change，三者 complete 才放开支付按钮
let states = { number: false, expiry: false, cvc: false }
number.on('change', (e) => { states.number = e.complete })
// ... expiry / cvc 同理

// confirm 只传 cardNumber 元素
await nexus.confirmCardPayment(clientSecret, { payment_method: { card: number } })
```

Vue 用 `NexusCardNumberElement` / `NexusCardExpiryElement` / `NexusCardCvcElement`，见 `examples/src/views/CardSplitView.vue`。

注意：brand 目前不会自动传播到 cvc 字段（Amex 4 位 CVC 需手动 `cvc.update({ brand })`）。

---

## 4. 流程三：Payment Element（聚合支付）

单组件渲染多支付方式选择器（默认 card + ideal），支持 tabs / accordion / radio 三种布局。

```ts
const elements = nexus.elements()
const payment = elements.create('payment', {
  layout: 'tabs',
  paymentMethods: ['card', 'ideal'],
  defaultPaymentMethod: 'card',
})
payment.mount('#payment')

payment.on('change', (e) => {
  // e.complete 控制按钮；e.paymentMethodType 为当前选中方式
})

// 用通用 confirmPayment（elements 路径）
const { error, paymentIntent } = await nexus.confirmPayment({
  elements,
  clientSecret,
  confirmParams: { return_url: location.origin + location.pathname },
  redirect: 'if_required',    // 可选：requires_action 时不自动跳转
})
```

创建 PaymentIntent 时后端需带 `payment_method_types: ['card', 'ideal']`。重定向类方式（iDEAL）确认后同样走 return_url 回跳。运行时切换布局：`payment.update({ layout: 'accordion' })`，不重建组件。

---

## 5. 流程四：Express Checkout（钱包按钮）

Apple Pay / Google Pay / PayPal / Link 一键支付按钮。流程不同于表单类：**监听 `confirm` 事件 → 自行创建 intent + 换取 paymentMethodId → `confirmPayment` 直接路径 → 回调 `complete()`**。

```ts
const ec = elements.create('expressCheckout', {
  buttonType: { default: 'pay' },
  buttonTheme: { default: 'black' },
  buttonHeight: 44,
  layout: { maxColumns: 2 },
  paymentMethods: { applePay: 'always', paypal: 'never' },
})
ec.mount('#express')

ec.on('ready', (e) => { /* e.availablePaymentMethods: { applePay: true, ... } */ })

ec.on('confirm', async ({ walletType, complete }) => {
  // 1. 创建 PaymentIntent
  const { payment_intent } = await createIntent()
  // 2. 钱包授权换 paymentMethodId（mock：POST /v1/tokens { payment_method_type: walletType }）
  const { payment_method_id } = await authorizeWallet(walletType)
  // 3. 直接路径确认（无 elements、无 tokenize）
  const { error, paymentIntent } = await nexus.confirmPayment({
    clientSecret: payment_intent.client_secret,
    paymentMethodId: payment_method_id,
  })
  // 4. 必须回调 complete，按钮显示 ✓/✕ 反馈
  complete(error || paymentIntent?.status !== 'succeeded' ? 'fail' : 'success')
})
```

完整示例见 `examples/src/views/ExpressCheckoutView.vue`。当前钱包授权为 mock，真实钱包 SDK 未接入。

---

## 6. 3DS 验证流程

触发条件：confirm 返回 `paymentIntent.status === 'requires_action'`。

```
confirm → requires_action + next_action.redirect_url
   → SDK 自动整页跳转挑战页（redirect: 'if_required' 可抑制）
   → 用户批准/拒绝
   → 浏览器回跳 return_url?status=approved|failed&intent=pi_xxx
```

商户页面需在加载时处理回跳参数：

```ts
onMounted(() => {
  const params = new URLSearchParams(location.search)
  const status = params.get('status')     // 'approved' | 'failed'
  const intentId = params.get('intent')
  if (status === 'approved') { /* 展示成功；可再查询 intent 终态 */ }
  if (status === 'failed') { /* 提示重新支付 */ }
})
```

要点：

- `confirmCardPayment` 总是自动跳转；`confirmPayment` 传 `redirect: 'if_required'` 可拿到 `requires_action` 结果自行处理
- `return_url` 建议 `location.origin + location.pathname`（去掉旧 query）
- 测试卡 `4000 0000 0000 3220` 稳定触发 3DS

---

## 7. 主题定制与运行时更新

```ts
// 初始
const elements = nexus.elements({
  appearance: {
    theme: 'night',
    variables: { colorPrimary: '#7c6bff', borderRadius: '8px' },
    rules: { '.Input:focus': { boxShadow: '0 0 0 2px #7c6bff' } },
  },
})

// 运行时热切换（不重建 iframe，E2E 已验证）
elements.update({ appearance: { theme: 'flat' } })
```

Vue 下把 `options` 设为响应式即可，Provider 深监听自动调用 `update`。

### 7.1 Element 级 style 选项

除全局 appearance 外，每个元素还支持 **状态级样式对象**，按 `base / empty / focus / invalid / complete / disabled` 六种状态分别设置 CSS 属性：

```ts
const card = elements.create('card', {
  style: {
    base: {
      fontSize: '16px',
      color: '#30313d',
      fontFamily: '"Inter", sans-serif',
      borderRadius: '8px',
    },
    focus: {
      boxShadow: '0 0 0 2px #7c6bff',
      borderColor: '#7c6bff',
    },
    invalid: {
      color: '#df1b41',
      borderColor: '#df1b41',
    },
    complete: {
      color: '#0abf53',
    },
  },
})
```

| 状态 key | 生效条件 |
|----------|---------|
| `base` | 始终生效 |
| `empty` | 字段值为空 |
| `focus` | 字段获得焦点 |
| `invalid` | 校验不通过且已完整输入 |
| `complete` | 校验通过且完整输入 |
| `disabled` | 元素被禁用 |

支持的 CSS 属性：`color`、`backgroundColor`、`fontFamily`、`fontSize`、`fontWeight`、`fontStyle`、`fontVariant`、`lineHeight`、`letterSpacing`、`textAlign`、`textDecoration`、`textShadow`、`textTransform`、`placeholderColor`、`iconColor`、`border`、`borderRadius`、`padding`、`margin`、`boxShadow`、`cursor`、`transition`。

已支持元素：`card`、`cardNumber`、`cardExpiry`、`cardCvc`、`iban`。

> **与 appearance 的关系**：`appearance.rules` 作用于全局选择器（如 `.Input:focus`），`style` 作用于单个元素实例。两者可叠加，`style` 优先级更高。

---

## 8. 常见问题

| 问题 | 处理 |
|------|------|
| iframe 加载空白 | 检查 `fieldsUrl` 是否指向 fields 构建产物；本仓库开发模式改动 fields 后需 `pnpm --filter @nexus-elements/fields build` |
| `Invalid publishable key` | key 必须 `pk_test_` / `pk_live_` 前缀 |
| confirm 返回 `No mounted element found` | 元素尚未 `mount`，或已被 unmount |
| token_already_used | token 一次性，重复 confirm 需重新走 tokenize（重新点支付即可） |
| 拆分卡 Amex CVC 校验 4 位不生效 | brand 跨 iframe 传播未实现，需 `cvc.update({ brand: 'amex' })` |
| 事件拿不到 | 事件名区分：元素级 `change/ready/...`（§api-reference 4），Provider 级仅 `ready` |
