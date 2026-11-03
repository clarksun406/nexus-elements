# Nexus Elements — SDK API 参考

> 覆盖 `@nexus-elements/core` 与 `@nexus-elements/vue` 的公开 API。
> 标注 ⬜ 的能力尚未实现（对照 [implementation-status.md](implementation-status.md)）。

---

## 1. SDK 入口

### createNexus(publishableKey, options?)

```ts
import { createNexus } from '@nexus-elements/core'

const nexus = createNexus('pk_test_xxx', { apiBase: '', locale: 'zh' })
```

- `publishableKey` 必须以 `pk_test_` 或 `pk_live_` 开头，否则抛出 `Error`
- 返回 `Nexus` 实例

**NexusOptions**

| 字段 | 类型 | 说明 |
|------|------|------|
| `apiBase` | `string` | 后端 API 前缀，默认 `''`（同源 `/v1/*`） |
| `locale` | `SupportedLocale` | 语言，会传到字段 iframe |
| `nexusAccount` | `string` | 平台账户，确认与 tokenize 时作为 `X-Nexus-Account` |
| `fieldsUrl` | `string` | 字段 iframe 地址。生产环境应为独立源站 |
| `cdn` / `scriptUrl` | `boolean` / `string` | `loadNexus` 是否先插入 CDN script |

### loadNexus(publishableKey, options?)

`createNexus` 的 Promise 版本。默认直接使用已打包的模块。传入 `{ cdn: true }` 或 `{ scriptUrl }` 时先加载脚本，再调用 `window.Nexus.createNexus`。

### loadScript(options?)

CDN script 加载器：去重（已有 `window.Nexus` 或同 src script 则复用）、指数退避重试（默认 3 次）、可选 SRI。

```ts
await loadScript({ url: 'https://js.nexuspay.com/v1/nexus.js', integrity: 'sha384-...', retries: 3 })
```

### nexus.setFieldsUrl(url)

设置 fields iframe 页面地址（如 `/fields/index.html` 或独立域 URL）。必须在 `nexus.elements()` 之前调用。

---

## 2. Nexus 实例方法

### nexus.elements(options?) → NexusElements

创建 Elements 工厂，同一实例下的元素共享 appearance / locale / clientSecret，拆分卡字段自动成组。

**ElementsOptions**

| 字段 | 类型 | 说明 |
|------|------|------|
| `appearance` | `Appearance` | 主题（见 §6） |
| `locale` | `SupportedLocale` | 默认 `'en'` |
| `clientSecret` | `string` | Intent 密钥，`confirmPayment` 可省略参数时使用 |
| `fonts` | `Array<{family, src, weight?, style?}>` | 自定义字体 ⬜ |

### nexus.confirmCardPayment(clientSecret, params) → Promise\<ConfirmResult\>

Card / 拆分卡流程的确认。内部：iframe tokenize → `POST /v1/payment_intents/confirm` → 若 `requires_action` 且返回 `next_action.redirect_url` 则**自动整页跳转** 3DS。

```ts
const { error, paymentIntent } = await nexus.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,               // NexusElement 实例（card 或 cardNumber）
    billing_details: { name, email, phone, address },
  },
  receipt_email: 'a@b.com',
  return_url: location.href,         // 3DS 完成后回跳地址
})
```

### nexus.confirmPayment(params) → Promise\<ConfirmResult\>

通用确认，两条路径：

```ts
// 路径 A：elements（tokenize 首个 mounted 的 payment 元素）
await nexus.confirmPayment({
  elements,
  clientSecret,                      // 可省略，回退 elements 的 clientSecret
  confirmParams: {
    return_url: location.href,
    receipt_email: 'a@b.com',
    payment_method_data: { billing_details: {...} },
  },
  redirect: 'if_required',           // 'always'（默认）| 'if_required'：抑制自动 3DS 跳转
})

// 路径 B：paymentMethodId 直接确认（钱包流程，跳过 tokenize）
await nexus.confirmPayment({ clientSecret, paymentMethodId: 'pm_test_xxx' })
```

### nexus.confirmSetup(params) → Promise\<ConfirmResult\<'setup'\>\>

保存卡片（SetupIntent）。tokenize 首个 mounted 元素 → `POST /v1/setup_intents/confirm`，返回 `{ error?, setupIntent? }`。

```ts
await nexus.confirmSetup({ elements, clientSecret, confirmParams: { return_url: location.href } })
```

### nexus.initEmbeddedCheckout({ clientSecret }) → EmbeddedCheckoutInstance

返回 `{ mount(target), unmount(), destroy() }`。⬜ 托管结账页 `/__nexus-checkout` 尚未实现，当前仅骨架。

---

## 3. NexusElements 实例

| 方法 | 说明 |
|------|------|
| `create(type, options?)` | 创建元素。type 见 §5；未知 type 会在 iframe 内回退渲染 CardField ⬜ |
| `getElement(id)` | 按内部 id 取元素 |
| `update(options)` | 合并更新 options；`appearance` 变更会热更新所有已挂载 iframe |
| `fetchUpdates()` | 通知已挂载的 cart / order / payment 元素刷新。Order 在配置了 `pollInterval` 时也会轮询 `GET /v1/orders/:id` |
| `destroyAll()` | 销毁全部元素 |
| `getClientSecret()` | 返回构造时的 `clientSecret` |

---

## 4. NexusElement 实例

| 方法 | 说明 |
|------|------|
| `mount(target)` | `selector \| HTMLElement`，创建 sandboxed iframe 并挂载；重复挂载/已销毁抛错。sandbox 不含 `allow-top-navigation` |
| `collapse()` | 通知 Payment Element 折叠手风琴 |
| `fetchUpdates()` | 向该元素发送刷新 |
| `unmount()` | 移除 iframe、解绑桥，可重新 mount |
| `destroy()` | unmount + 清空监听，不可复用 |
| `update(options)` | 运行时合并更新，返回 `Promise<void>`（等待 iframe ready） |
| `focus()` / `blur()` / `clear()` | 控制 iframe 内输入 |
| `on(event, handler)` / `off(event, handler?)` | 事件订阅；`off` 不传 handler 清空该事件 |
| `isMounted()` | 是否已挂载 |

> `tokenize(clientSecret, billingDetails?)` 为 confirm 系列内部使用，一般不直接调用。拆分卡字段调用时会自动聚合同组兄弟字段数据。

### 事件

| 事件 | 触发时机 | payload |
|------|---------|---------|
| `ready` | iframe 渲染完成 | `{ elementType, availablePaymentMethods? }`（后者仅 expressCheckout） |
| `change` | 输入/校验状态变化 | `ChangeEvent`（见下） |
| `focus` / `blur` | 焦点变化 | `{}` |
| `escape` | iframe 内按 Esc | `{}` |
| `click` | 元素点击 | 透传 payload |
| `error` | 字段层错误 | 透传 payload |
| `confirm` | 钱包按钮点击（expressCheckout） | `{ walletType, complete(status: 'success' \| 'fail') }` |
| `cancel` | 钱包取消（核心已接线，字段层无取消 UI ⬜） | `{}` |
| `input` / `loaderror` | 已定义未使用 ⬜ | — |

**ChangeEvent**

```ts
{
  complete: boolean       // 全部字段有效且完整
  empty: boolean
  valid: boolean
  elementType: ElementType
  brand?: CardBrand       // 卡组件：visa | mastercard | amex | discover | jcb | unionpay | diners | ...
  paymentMethodType?: string  // payment 组件当前选中方式
  error?: ElementError    // { type: 'invalid_number' | 'incomplete_expiry' | ..., message }
}
```

---

## 5. 元素类型与 options

全部 19 种元素类型均已实现。

### card（合并卡）— CardElementOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `showIcon` / `hideIcon` | `boolean` | 品牌 SVG 图标（10 品牌内联 SVG，💳 fallback） |
| `hidePostalCode` | `boolean` | 控制 postal code 字段显隐，默认显示（`false`） |
| `disabled` | `boolean` | 禁用 |
| `placeholder` | `string` | 卡号占位符 |
| `style` | `ElementStyle` | 状态级样式对象（`base/empty/focus/invalid/complete/disabled`，见 §6.1） |

### cardNumber / cardExpiry / cardCvc（拆分）

各自支持 `placeholder` / `disabled` / `style`。同一 `elements` 实例下自动成组：对任一字段发起 confirm，SDK 自动聚合三段数据 tokenize。注意 ⬜：brand 不会自动从 cardNumber 传播到 cvc 字段。

### payment — PaymentElementOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `layout` | `'tabs' \| 'accordion' \| 'radio'` | 三种布局 |
| `defaultPaymentMethod` | `string` | 默认选中方式 |
| `paymentMethods` | （经 create options 传入）| 渲染的方式列表，默认 card + ideal |
| `business` | `{ name, amount, currency, country? }` | 商户展示信息 |
| `wallets` | `Array<'applePay' \| 'googlePay' \| 'paypal' \| 'link'>` | 内嵌钱包 ⬜ |
| `fields.billingDetails` | 各字段 `'auto' \| 'never' \| 'optional' \| 'required'` | ⬜ |
| `defaultValues.billingDetails` | 预填 | ⬜ |

### expressCheckout — ExpressCheckoutElementOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `paymentMethods` | `Record<string, 'auto' \| 'always' \| 'never'>` | 各钱包可用性（auto 为 mock 全可用） |
| `buttonType` | `Record<string, 'plain' \| 'pay' \| 'buy' \| 'book' \| 'donate'>` | 按钱包配置，`default` 键为兜底 |
| `buttonTheme` | `Record<string, 'black' \| 'white' \| 'white-outline'>` | 同上 |
| `buttonHeight` | `number` | 按钮高度 px |
| `layout` | `{ maxColumns?, maxRows?, overflow? }` | 网格布局 |

---

## 6. Appearance 主题

```ts
const appearance: Appearance = {
  theme: 'stripe',              // 'stripe' | 'flat' | 'night' | 'none'
  variables: {
    colorPrimary: '#635bff', colorBackground: '#fff', colorText: '#30313d',
    colorDanger: '#df1b41', colorWarning: '#e68600', colorSuccess: '#30b130',
    colorTextPlaceholder: '#8792a2', colorIcon: '#8792a2', colorIconCheckmark: '#30b130',
    colorBorder: '#e0e6ed', colorBorderFocus: '#635bff', colorTextSecondary: '#8898aa',
    borderRadius: '6px', fontFamily: '...', fontSizeBase: '16px', fontSizeSm: '13px',
    spacingUnit: '4px', spacingTab: '8px', spacingGridRow: '8px', spacingGridColumn: '8px',
    gridGutter: '12px',
  },
  rules: {
    '.Input': { borderColor: '#ccc' },
    '.Input:hover': { borderColor: '#635bff' },
    '.Input--disabled': { cursor: 'not-allowed' },
    '.Tab--selected': { color: '#635bff' },
    // 支持 18 类选择器：.Input / .Input:hover / .Input--disabled / .Input--focus /
    // .Input--error / .Label / .Error / .Tab / .Tab:hover / .Tab--selected /
    // .Block / .Radio / .Icon / .AccordionItem / .Checkbox / .CheckboxInput /
    // .CheckboxInput--checked / .CheckboxInput:focus
  },
}
```

- `variables`（21 个）映射为 `--nexus-*` CSS 变量注入 iframe
- `rules`（18 类选择器）映射为内部 CSS class 注入 `<style>` 标签
- 运行时切换：`elements.update({ appearance })` 热更新，不重建 iframe
- 底层工具：`resolveAppearance(appearance)`、`THEME_PRESETS` 亦从 core 导出
- **交互演示**：`/appearance` 示例页提供完整的变量/规则/字体/语言/样式可视化调试

### 6.1 ElementStyle（元素级状态样式）

每个元素 options 的 `style` 字段接受按状态区分的样式对象，由 `useElementStyle` 组合式函数注入 iframe 动态 `<style>` 标签。

```ts
interface ElementStyleState {
  color?: string; backgroundColor?: string; fontFamily?: string; fontSize?: string
  fontWeight?: string; fontStyle?: string; fontVariant?: string
  lineHeight?: string | number; letterSpacing?: string; textAlign?: string
  textDecoration?: string; textShadow?: string; textTransform?: string
  placeholderColor?: string; iconColor?: string
  border?: string; borderRadius?: string; padding?: string; margin?: string
  boxShadow?: string; cursor?: string; transition?: string
}

interface ElementStyle {
  base?: ElementStyleState       // 始终生效
  empty?: ElementStyleState      // 字段值为空
  focus?: ElementStyleState      // 字段获得焦点
  invalid?: ElementStyleState    // 校验不通过
  complete?: ElementStyleState   // 校验通过且完整
  disabled?: ElementStyleState   // 元素被禁用
}
```

已支持元素：`card`、`cardNumber`、`cardExpiry`、`cardCvc`、`iban`。

> `appearance.rules` 按选择器全局生效，`style` 按元素实例生效。两者可叠加，`style` 优先级更高。

---

## 7. 确认结果与错误

```ts
interface ConfirmResult {
  error?: ConfirmError
  paymentIntent?: PaymentIntent    // confirmSetup 时为 setupIntent
}

interface ConfirmError {
  type: 'api_error' | 'card_error' | 'validation_error' | 'network_error'
  code?: string                    // card_declined | insufficient_funds | expired_card | incorrect_cvc | ...
  message: string
  decline_code?: string
  payment_intent?: PaymentIntent
}
```

**PaymentIntent.status**：`requires_payment_method → requires_confirmation → requires_action → processing → succeeded | canceled`

错误码全集与 HTTP 约定见 [backend-api.md §1.3](backend-api.md)。

---

## 8. @nexus-elements/vue

### 组件

```ts
import {
  NexusElements,                // Provider（NexusElementsProvider）
  NexusElement,                 // 通用包装，props: { type, options? }
  NexusCardElement, NexusCardNumberElement, NexusCardExpiryElement, NexusCardCvcElement,
  NexusPaymentElement, NexusExpressCheckoutElement,
  NexusIbanElement, NexusAddressElement,
  NexusIdealBankElement, NexusFpxBankElement, NexusEpsBankElement, NexusP24BankElement,
  NexusAuBankAccountElement, NexusPaymentMessagingElement, NexusLinkAuthenticationElement,
  NexusCartElement, NexusOrderElement, NexusAfterpayClearpayElement, NexusWalletButtonElement,
} from '@nexus-elements/vue'
```

**NexusElements（Provider）**

| Prop / 事件 | 说明 |
|------------|------|
| `publishable-key`（必填） | 变更时销毁并重建全部元素 |
| `options` | `ElementsOptions`，深监听 → `elements.update()` 热更新 |
| `fields-url` | 透传 `nexus.setFieldsUrl()` |
| `@ready` | `(nexus, elements) => void` |

**元素组件**：prop `options`（深监听 → `element.update()`）；转发全部元素事件（`@change` `@ready` `@focus` `@blur` `@confirm` 等）；`ref` 暴露 `getElement(): NexusElement | undefined`。

### Composables 与插件

```ts
import { useNexus, useElements, useElement, useNexusInstance, NexusVuePlugin } from '@nexus-elements/vue'
```

- `useNexus()` / `useElements()`：在 Provider 后代中取 `Nexus` / `NexusElements` 实例
- `useElement(type, options)`：创建并管理单个元素生命周期
- `NexusVuePlugin`：`app.use(NexusVuePlugin, { publishableKey, ... })` 全局注入
