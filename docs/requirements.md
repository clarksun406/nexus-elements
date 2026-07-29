# Nexus Elements 需求文档（PRD）

> 仿照 Stripe Elements 产品设计，自研全量支付要素组件库。
> stripe-element-example 项目作为 API 设计与交互行为参照。

## 一、项目概述

### 1.1 项目名称

**Nexus Elements** — 仿 Stripe Elements 的支付 UI 组件库

### 1.2 项目目标

构建一套与 Stripe Elements 功能对等的支付表单 UI 组件库，覆盖全部 19 种 Element 组件，提供安全、灵活、可定制化的支付信息收集能力。SDK 本身框架无关（原生 TypeScript 实现），Vue 适配层作为一等公民优先交付。

### 1.3 核心设计原则

| 原则 | 说明 |
|------|------|
| **安全性** | 敏感支付数据通过 iframe 隔离，PCI-DSS 合规 |
| **可定制性** | 支持外观/主题/尺寸的深度定制 |
| **多支付方式** | 覆盖银行卡、钱包、银行转账、BNPL 等全支付方式 |
| **框架无关** | 核心为原生 TS，Vue 适配层优先，React 适配层后续扩展 |
| **国际化** | 多语言、多货币、多地区适配 |
| **API 对齐** | 与 Stripe Elements API 命名/结构对齐，最小化迁移成本 |

### 1.4 与 Stripe Elements 的对标关系

| Stripe Elements | Nexus Elements | 说明 |
|-----------------|----------------|------|
| `Stripe(publishableKey)` | `Nexus(publishableKey)` | SDK 入口 |
| `stripe.elements(options)` | `nexus.elements(options)` | Elements 实例工厂 |
| `elements.create('card')` | `elements.create('card')` | 创建组件实例 |
| `element.mount('#selector')` | `element.mount('#selector')` | 挂载到 DOM |
| `stripe.confirmCardPayment(...)` | `nexus.confirmCardPayment(...)` | 确认支付 |
| `stripe.confirmPayment({elements,...})` | `nexus.confirmPayment({elements,...})` | 通用确认 |
| Stripe.js CDN 加载 | Nexus SDK CDN / npm | 分发方式 |

---

## 二、整体架构

### 2.1 系统分层

```
┌─────────────────────────────────────────────────┐
│              Merchant Application               │
│  (Vue / React / Vanilla JS)                     │
├─────────────────────────────────────────────────┤
│         Framework Adapters (可选)                │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │ @nexus/vue    │  │ @nexus/react (后续)     │  │
│  └───────────────┘  └────────────────────────┘  │
├─────────────────────────────────────────────────┤
│         Nexus Elements SDK (核心层)              │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ Element   │ │ Element   │ │ Element       │ │
│  │ Manager   │ │ Factory   │ │ Event Bus     │ │
│  └───────────┘ └───────────┘ └───────────────┘ │
├─────────────────────────────────────────────────┤
│         Secure Iframe Layer (PCI Compliance)     │
│  ┌───────────────────────────────────────────┐  │
│  │  Input Sanitizer │ Tokenizer │ Validator  │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│         Merchant Backend (商户自建，不在本项目范围) │
│  Tokenization / Confirmation / Webhook           │
└─────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术方案 | 说明 |
|------|---------|------|
| 核心渲染引擎 | TypeScript + Vue 3（iframe 内部渲染） | iframe 内用 Vue 实现字段 UI，对外 API 框架无关 |
| Iframe 通信 | `postMessage` + HMAC 消息签名 | |
| 样式系统 | CSS Variables 主题系统 | 无运行时 CSS-in-JS 依赖 |
| Vue 适配 | `@nexus-elements/vue` | 一等公民，优先交付 |
| React 适配 | `@nexus-elements/react` | 后续扩展 |
| 构建工具 | Vite 6+（库模式 + 开发调试） | |
| 包管理 | pnpm monorepo | |
| 测试 | Vitest + @vue/test-utils + Playwright (E2E) | |
| 文档 | Storybook + API Reference | |

### 2.3 仓库结构

```
nexus-elements/
├── packages/
│   ├── core/                    # @nexus-elements/core — 框架无关 SDK 核心
│   │   ├── src/
│   │   │   ├── nexus.ts         # Nexus 入口类
│   │   │   ├── elements.ts      # Elements 工厂 + Element 实例管理
│   │   │   ├── iframe/          # iframe 创建 / postMessage 桥 / 消息签名
│   │   │   ├── loader.ts        # CDN 异步加载器（SRI）
│   │   │   ├── confirm/         # confirmCardPayment / confirmPayment / confirmSetup
│   │   │   ├── theme/           # Appearance 主题引擎
│   │   │   ├── i18n/            # 国际化
│   │   │   └── types/           # 全量类型定义
│   │   └── package.json
│   ├── fields/                  # @nexus-elements/fields — iframe 内字段 UI（Vue 3 实现）
│   │   ├── src/
│   │   │   ├── fields/          # 19 种 Element 的字段渲染
│   │   │   ├── validation/      # 校验器注册表（Luhn / MOD-97 / 格式）
│   │   │   ├── formatting/      # 输入格式化引擎
│   │   │   ├── tokenize/        # 敏感数据加密 + token 换取
│   │   │   ├── bridge.ts        # 宿主通信层
│   │   │   └── assets/          # 品牌图标 / 银行 Logo / 国旗
│   │   └── package.json
│   └── vue/                     # @nexus-elements/vue — Vue 适配层
│       ├── src/
│       │   ├── components/      # <NexusElement> / <CardElement> / <PaymentElement> ...
│       │   ├── composables/     # useNexus / useElements / useConfirm
│       │   └── plugin.ts
│       └── package.json
├── examples/                    # 示例应用（Vue + Vite，对标 12 个 demo 页面）
├── docs/
├── pnpm-workspace.yaml
└── package.json
```

---

## 三、全 Element 组件清单

### 3.1 组件总览

| # | 组件名称 | type 标识 | 描述 | 收集字段 | 优先级 |
|---|---------|-----------|------|---------|--------|
| 1 | Payment Element | `payment` | 统一支付组件（聚合所有支付方式） | 动态 | P0 |
| 2 | Card Element | `card` | 合并银行卡输入 | 卡号/有效期/CVC | P0 |
| 3 | CardNumber Element | `cardNumber` | 独立卡号输入 | 卡号 | P0 |
| 4 | CardExpiry Element | `cardExpiry` | 独立有效期输入 | 有效期 | P0 |
| 5 | CardCvc Element | `cardCvc` | 独立 CVC 输入 | CVC | P0 |
| 6 | Express Checkout Element | `expressCheckout` | 快速结账按钮组 | — | P1 |
| 7 | Address Element | `address` | 地址收集与自动补全 | 地址全字段 | P1 |
| 8 | Ideal Bank Element | `idealBank` | iDEAL 银行选择 | 银行ID | P1 |
| 9 | Iban Element | `iban` | 国际银行账户 | IBAN | P1 |
| 10 | Au Bank Account Element | `auBankAccount` | 澳洲银行账户 (BECS) | BSB/账号 | P2 |
| 11 | Fpx Bank Element | `fpxBank` | 马来西亚 FPX 银行选择 | 银行ID | P2 |
| 12 | Eps Bank Element | `epsBank` | 奥地利 EPS 银行选择 | 银行ID | P2 |
| 13 | P24 Bank Element | `p24Bank` | 波兰 Przelewy24 银行选择 | 银行ID | P2 |
| 14 | Payment Method Messaging Element | `paymentMethodMessaging` | BNPL 分期信息展示 | — | P2 |
| 15 | Afterpay Clearpay Element | `afterpayClearpay` | BNPL 消息展示 | — | P2 |
| 16 | Link Authentication Element | `linkAuthentication` | 快捷登录（OTP） | 手机号/邮箱 | P2 |
| 17 | Cart Element | `cart` | 购物车摘要展示 | — | P2 |
| 18 | Order Element | `order` | 订单详情展示 | — | P2 |
| 19 | Wallet Button Element | `walletButton` | 单钱包按钮 | — | P1 |

---

## 四、各 Element 详细需求

### 4.1 Payment Element（核心聚合组件）

```
┌─────────────────────────────────────────────┐
│  Card   Apple Pay   iDEAL   PayPal           │
│ ┌─────────────────────────────────────────┐ │
│ │  [动态渲染选中支付方式的子表单]            │ │
│ │  Card Number: [4242 4242 4242 4242]     │ │
│ │  Expiry: [12/28]   CVC: [123]           │ │
│ │  [● Remember me for future purchases]   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| PE-001 | 根据商户配置的支付方式列表，自动渲染支付方式选择器 | P0 |
| PE-002 | 布局模式：`tabs` / `accordion` / `radio` | P0 |
| PE-003 | 切换支付方式时动态渲染对应的子表单 | P0 |
| PE-004 | 支持默认选中指定支付方式 | P1 |
| PE-005 | 根据金额/地区/货币自动排序/过滤可用支付方式 | P1 |
| PE-006 | 支持保存的支付方式列表展示与选择 | P1 |
| PE-007 | 内嵌 Link Authentication（自动检测用户） | P2 |
| PE-008 | 事件：`change` / `ready` / `focus` / `blur` | P0 |
| PE-009 | 提交前校验所有子表单，返回错误集合 | P0 |
| PE-010 | billingDetails 字段控制：`auto` / `never` / `optional` / `required` | P1 |
| PE-011 | `defaultValues` 预填（name/email/phone/address）+ 已填字段隐藏 | P1 |
| PE-012 | 运行时更新：金额/币种/支付方式变更不重建组件（对标 Update 模式） | P0 |

#### 配置参数

```typescript
interface PaymentElementOptions {
  paymentMethods?: PaymentMethodConfig[];
  layout?: 'tabs' | 'accordion' | 'radio';
  defaultPaymentMethod?: string;
  business?: {
    name: string;
    amount: number;
    currency: string;
    country?: string;
  };
  appearance?: Appearance;
  allowSavePaymentMethod?: boolean;
  wallets?: ('applePay' | 'googlePay' | 'paypal' | 'link')[];
  locale?: SupportedLocale;
  fields?: {
    billingDetails?: {
      name?: 'auto' | 'never' | 'optional' | 'required';
      email?: 'auto' | 'never' | 'optional' | 'required';
      phone?: 'auto' | 'never' | 'optional' | 'required';
      address?: 'auto' | 'never' | 'optional' | 'required';
    };
  };
  defaultValues?: {
    billingDetails?: {
      name?: string;
      email?: string;
      phone?: string;
      address?: AddressValue;
    };
  };
}
```

---

### 4.2 Card Element（银行卡合并组件）

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐ │
│ │  4242 4242 4242 4242          12/28  123 │ │
│ └─────────────────────────────────────────┘ │
│  Your card number is incomplete.             │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| CE-001 | 卡号自动格式化（4-4-4-4，Amex 4-6-5） | P0 |
| CE-002 | 卡品牌实时检测（BIN 号规则） | P0 |
| CE-003 | 品牌图标显示（Visa/Mastercard/Amex/Discover/JCB/UnionPay/Diners/Elo/Hipercard/Mir） | P0 |
| CE-004 | 有效期自动格式化（MM/YY）+ 过期校验 | P0 |
| CE-005 | CVC 长度随品牌动态调整（Amex 4位，其他3位） | P0 |
| CE-006 | 实时校验 + 错误提示（`invalid` / `incomplete` 区分） | P0 |
| CE-007 | 键盘流转：Tab 跨段、退格跨段回退、方向键导航 | P0 |
| CE-008 | `hidePostalCode` / `hideIcon` / `showIcon` 配置 | P1 |
| CE-009 | 粘贴自动填充与清洗（跨段分配） | P1 |
| CE-010 | `disabled` 状态 | P1 |
| CE-011 | 移动端数字键盘（inputmode=numeric） | P0 |

#### 卡品牌 BIN 规则

```typescript
type CardBrand =
  | 'visa' | 'mastercard' | 'amex' | 'discover' | 'jcb'
  | 'unionpay' | 'diners' | 'elo' | 'hipercard' | 'mir' | 'unknown';

interface BinRule {
  brand: CardBrand;
  patterns: number[][];      // BIN 范围 [[4,4],[51,55],[2221,2720]...]
  lengths: number[];          // 卡号长度 [16] / [15] / [16,19]
  cvcLength: number;          // CVC 长度
  luhn: boolean;              // 是否 Luhn 校验
  gaps: number[];             // 格式化空格位置 [4,8,12] / [4,10]
  icon: string;               // 品牌 SVG
}
```

---

### 4.3 — 4.5 独立 Card 子组件

#### CardNumber Element

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| CN-001 | 独立卡号输入框 + 格式化 | P0 |
| CN-002 | 品牌检测与图标（`showIcon` 选项） | P0 |
| CN-003 | Luhn 校验 + 品牌长度校验 | P0 |
| CN-004 | `placeholder` 自定义 | P1 |

#### CardExpiry Element

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| CX-001 | 独立有效期输入 + MM/YY 自动格式化（自动补 `/`、月份补零） | P0 |
| CX-002 | 过期校验：不早于当前月，不超 20 年 | P0 |
| CX-003 | `placeholder` 自定义（默认 "MM / YY"） | P1 |

#### CardCvc Element

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| CC-001 | 独立 CVC 输入，密码式显示 | P0 |
| CC-002 | 根据 brand 动态调整最大长度 | P0 |
| CC-003 | `placeholder` 自定义 | P1 |

---

### 4.6 Express Checkout Element（快速结账）

```
┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐
│  Pay     │ │  G Pay     │ │  PayPal  │ │  Link    │
└──────────┘ └────────────┘ └──────────┘ └──────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| EC-001 | 自动检测设备支持的钱包类型，不支持的自动隐藏 | P1 |
| EC-002 | Apple Pay 按钮（Safari + HTTPS 检测） | P1 |
| EC-003 | Google Pay 按钮（Chrome/Android 检测） | P1 |
| EC-004 | PayPal 按钮 | P1 |
| EC-005 | Link 按钮 | P2 |
| EC-006 | 按钮样式：`type`（pay/book/donate/buy）× 颜色（black/white/white-outline）× 尺寸 | P1 |
| EC-007 | 布局：`horizontal` / `vertical`，间距可配 | P1 |
| EC-008 | `ready` 事件透出 `availablePaymentMethods` | P1 |
| EC-009 | `confirm` / `cancel` / `loaderror` 事件 | P1 |
| EC-010 | `complete(status)` 方法控制结果展示 | P1 |

#### 钱包支付流程

```
用户点击钱包按钮
    │
    ├─► Apple Pay  → Apple Pay Session → Payment Token
    ├─► Google Pay → PaymentsClient.loadPaymentData → Payment Token
    ├─► PayPal     → PayPal SDK → Approval Token
    └─► Link       → Link Authentication → Payment Method
    │
    ▼
confirmPayment(token) → 商户后端确认 → 返回结果
```

---

### 4.7 Address Element（地址收集）

```
┌─────────────────────────────────────────────┐
│  Country                                     │
│  ┌─────────────────────────────────────────┐│
│  │  United States                        ▼ ││
│  └─────────────────────────────────────────┘│
│  Address                                     │
│  ┌─────────────────────────────────────────┐│
│  │  123 Main Street                         ││
│  │  Apt, suite, etc. (optional)             ││
│  └─────────────────────────────────────────┘│
│  City          State          ZIP            │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐   │
│  │ New York│  │ NY     ▼ │  │ 10001   │   │
│  └─────────┘  └──────────┘  └─────────┘   │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| AE-001 | 国家选择器（250+ 国家/地区） | P1 |
| AE-002 | 地址行1 + 地址行2（可选） | P1 |
| AE-003 | 城市 / 省州 / 邮编 | P1 |
| AE-004 | 根据国家动态调整字段结构（标签/必填/类型/顺序） | P1 |
| AE-005 | 省州为下拉选择（US 州列表等） | P1 |
| AE-006 | 邮编格式校验（国家特定正则） | P1 |
| AE-007 | `mode: 'shipping' | 'billing'` 两种模式 | P1 |
| AE-008 | `defaultValues` 预填 | P1 |
| AE-009 | 联系方式字段（姓名/电话/邮箱）可选开启 | P2 |
| AE-010 | 地址自动补全（预留接口，后续接入地址服务） | P2 |

#### 国家差异字段配置

```typescript
interface AddressFieldConfig {
  country: string;
  fields: {
    addressLine1: { label: string; required: boolean };
    addressLine2: { label: string; required: boolean };
    city: { label: string; required: boolean };
    state: {
      label: string;
      required: boolean;
      type: 'text' | 'select';
      options?: { value: string; label: string }[];
    };
    postalCode: {
      label: string;
      required: boolean;
      format?: RegExp;
      placeholder?: string;
    };
  };
}
```

---

### 4.8 Ideal Bank Element（荷兰 iDEAL）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| IB-001 | 展示 iDEAL 银行列表（13 家） | P1 |
| IB-002 | 支持搜索过滤 | P1 |
| IB-003 | 银行 Logo 展示 | P1 |
| IB-004 | 选中状态高亮 + `change` 事件返回银行 ID | P1 |

```typescript
const IDEAL_BANKS = [
  { id: 'abn_amro', name: 'ABN AMRO' },
  { id: 'asn_bank', name: 'ASN Bank' },
  { id: 'bunq', name: 'Bunq' },
  { id: 'handelsbanken', name: 'Handelsbanken' },
  { id: 'ing', name: 'ING' },
  { id: 'knab', name: 'Knab' },
  { id: 'moneyou', name: 'Moneyou' },
  { id: 'rabobank', name: 'Rabobank' },
  { id: 'regiobank', name: 'RegioBank' },
  { id: 'revolut', name: 'Revolut' },
  { id: 'sns_bank', name: 'SNS Bank' },
  { id: 'triodos_bank', name: 'Triodos Bank' },
  { id: 'van_lanschot', name: 'Van Lanschot' },
] as const;
```

---

### 4.9 Iban Element（国际银行账户）

```
┌─────────────────────────────────────────────┐
│  IBAN                                        │
│  ┌─────────────────────────────────────────┐│
│  │  DE89 3704 0044 0532 0130 00        DE  ││
│  └─────────────────────────────────────────┘│
│  Valid IBAN for Germany                      │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| IBA-001 | IBAN 输入 + 自动格式化（每4位空格） | P1 |
| IBA-002 | 国家代码自动检测与国旗显示 | P1 |
| IBA-003 | MOD-97 校验算法 | P1 |
| IBA-004 | 根据国家动态设置长度限制（75+ 国家规则表） | P1 |
| IBA-005 | 错误提示：`invalid` / `incomplete` | P1 |
| IBA-006 | `placeholder` 自定义 | P2 |

核心国家规则（完整 75+ 国家数据文件）：

```typescript
const IBAN_COUNTRIES: Record<string, { length: number; name: string }> = {
  DE: { length: 22, name: 'Germany' },
  FR: { length: 27, name: 'France' },
  GB: { length: 22, name: 'United Kingdom' },
  IT: { length: 27, name: 'Italy' },
  ES: { length: 24, name: 'Spain' },
  NL: { length: 18, name: 'Netherlands' },
  BE: { length: 16, name: 'Belgium' },
  AT: { length: 20, name: 'Austria' },
  PT: { length: 25, name: 'Portugal' },
  IE: { length: 22, name: 'Ireland' },
  // ... 完整 75+ 国家
};
```

---

### 4.10 Au Bank Account Element（澳洲 BECS）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| AU-001 | BSB 号输入（6位，自动 `XXX-XXX` 格式化） | P2 |
| AU-002 | 账号输入（最多9位数字） | P2 |
| AU-003 | 账户持有人姓名 + 邮箱字段 | P2 |
| AU-004 | BSB 有效性校验 | P2 |
| AU-005 | `change` 事件返回完整银行账户信息 | P2 |

---

### 4.11 Fpx Bank Element（马来西亚 FPX）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| FPX-001 | 展示 FPX 银行列表（17 家） | P2 |
| FPX-002 | 搜索过滤 + 银行 Logo | P2 |
| FPX-003 | 区分在线/离线银行状态 | P2 |

```typescript
const FPX_BANKS = [
  { id: 'affin_bank', name: 'Affin Bank' },
  { id: 'agrobank', name: 'Agrobank' },
  { id: 'alliance_bank', name: 'Alliance Bank' },
  { id: 'am_bank', name: 'AmBank' },
  { id: 'bank_islam', name: 'Bank Islam' },
  { id: 'bank_muamalat', name: 'Bank Muamalat' },
  { id: 'bank_rakyat', name: 'Bank Rakyat' },
  { id: 'bank_simpanan', name: 'Bank Simpanan Nasional' },
  { id: 'cimb', name: 'CIMB Clicks' },
  { id: 'hong_leong', name: 'Hong Leong Bank' },
  { id: 'maybank2e', name: 'Maybank2E' },
  { id: 'maybank2u', name: 'Maybank2u' },
  { id: 'ocbc', name: 'OCBC Bank' },
  { id: 'public_bank', name: 'Public Bank' },
  { id: 'rhb', name: 'RHB Bank' },
  { id: 'standard_chartered', name: 'Standard Chartered' },
  { id: 'uob', name: 'UOB Bank' },
] as const;
```

---

### 4.12 Eps Bank Element（奥地利）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| EPS-001 | 展示奥地利 EPS 银行列表 | P2 |
| EPS-002 | 银行选择 + Logo | P2 |
| EPS-003 | `change` 事件返回选中银行 | P2 |

---

### 4.13 P24 Bank Element（波兰 Przelewy24）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| P24-001 | 展示波兰 P24 银行列表（50+ 银行） | P2 |
| P24-002 | 搜索过滤 | P2 |
| P24-003 | 银行 Logo + 虚拟滚动（性能优化） | P2 |

---

### 4.14 Payment Method Messaging Element

```
┌─────────────────────────────────────────────┐
│  Or pay in 4 interest-free payments of       │
│  $25.00 with Afterpay. Learn more            │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| PMM-001 | 根据金额/货币展示 BNPL 分期信息 | P2 |
| PMM-002 | 支持多 BNPL 品牌：Afterpay / Klarna / Affirm | P2 |
| PMM-003 | 自适应计算分期数与每期金额 | P2 |
| PMM-004 | `Learn more` 跳转/弹窗 | P2 |

---

### 4.15 Afterpay Clearpay Element

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| APC-001 | 根据金额计算分期（4期免息） | P2 |
| APC-002 | 品牌名根据地区切换（US=Afterpay / UK=Clearpay） | P2 |
| APC-003 | 金额不满足限额时的文案处理 | P2 |
| APC-004 | 消息样式：`default` / `compact` | P2 |
| APC-005 | 实时金额联动更新 | P2 |

```typescript
interface AfterpayClearpayElementOptions {
  amount: number;
  currency: 'USD' | 'GBP' | 'CAD' | 'AUD' | 'NZD' | 'EUR';
  locale?: 'en-US' | 'en-GB' | 'en-AU' | 'en-NZ' | 'en-CA' | 'fr-FR' | 'es-ES' | 'it-IT' | 'de-DE';
}
```

---

### 4.16 Link Authentication Element

```
┌─────────────────────────────────────────────┐
│  Sign in with Link                           │
│  ┌─────────────────────────────────────────┐│
│  │  +1 (555) 123-4567                       ││
│  └─────────────────────────────────────────┘│
│  We'll text you a 6-digit code to verify     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐            │
│  │  │ │  │ │  │ │  │ │  │ │  │            │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘            │
│  Didn't receive a code? Resend               │
└─────────────────────────────────────────────┘
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| LA-001 | 手机号输入 + 国家区号选择 | P2 |
| LA-002 | 邮箱输入（备选登录方式） | P2 |
| LA-003 | 发送验证码（6位 OTP） | P2 |
| LA-004 | 验证码 6 格独立输入框 | P2 |
| LA-005 | SMS 自动填充（Web OTP API） | P2 |
| LA-006 | 倒计时重发 | P2 |
| LA-007 | 已有用户 → 自动填充支付信息 | P2 |
| LA-008 | 手机号国际格式校验 | P2 |

---

### 4.17 Cart Element（购物车摘要）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| CART-001 | 商品列表展示（图片/名称/规格/数量/价格） | P2 |
| CART-002 | 小计 / 运费 / 税费 / 折扣 / 总计 | P2 |
| CART-003 | 优惠码输入与应用 | P2 |
| CART-004 | 数量编辑 + 商品删除 | P2 |
| CART-005 | 空购物车状态 | P2 |
| CART-006 | `fetchUpdates()` 与后端订单状态同步 | P2 |

---

### 4.18 Order Element（订单详情）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| ORD-001 | 订单状态展示（pending/paid/failed/cancelled） | P2 |
| ORD-002 | 订单商品明细 + 支付方式展示 | P2 |
| ORD-003 | 配送地址展示 | P2 |
| ORD-004 | 订单时间线 | P2 |
| ORD-005 | 实时状态更新（轮询 / WebSocket 预留） | P2 |

---

### 4.19 Wallet Button Element（独立钱包按钮）

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| WB-001 | Apple Pay / Google Pay / PayPal 独立按钮 | P1 |
| WB-002 | Link 独立按钮 | P2 |
| WB-003 | 按钮类型：`pay` / `buy` / `book` / `donate` | P1 |
| WB-004 | 颜色 / 尺寸 / 形状配置 | P1 |
| WB-005 | 设备兼容性检测与降级隐藏 | P1 |

---

## 五、通用能力需求

### 5.1 SDK 入口与 Element 生命周期

| 编号 | 需求 | 优先级 |
|------|------|--------|
| SDK-001 | `Nexus(publishableKey, options?)` 创建实例；密钥格式 `pk_live_xxx` / `pk_test_xxx` | P0 |
| SDK-002 | 分发方式：CDN script（全局 `window.Nexus`）+ npm ESM 导入 | P0 |
| SDK-003 | CDN 加载器：异步、去重、失败重试（3次指数退避）、SRI integrity + crossorigin 校验 | P0 |
| SDK-004 | `nexus.elements(options?)` 创建 Elements 组实例（共享 appearance / locale / clientSecret） | P0 |
| SDK-005 | `elements.create(type, options)` — 19 种 type | P0 |
| SDK-006 | `element.mount(selector \| HTMLElement)` — 内部创建 iframe | P0 |
| SDK-007 | `element.unmount()` / `element.destroy()` — 清理监听与 iframe | P0 |
| SDK-008 | `element.update(options)` — 运行时更新样式/配置 | P0 |
| SDK-009 | `element.clear()` / `element.focus()` / `element.blur()` | P1 |
| SDK-010 | `element.on(event, handler)` / `element.off(event, handler)` | P0 |
| SDK-011 | 支持 `nexusAccount` 选项（平台代收模式预留） | P2 |

### 5.2 支付确认 API

| 编号 | 需求 | 优先级 |
|------|------|--------|
| CFM-001 | `nexus.confirmCardPayment(clientSecret, { payment_method: { card, billing_details } })` → `{ paymentIntent } \| { error }` | P0 |
| CFM-002 | `nexus.confirmPayment({ elements, clientSecret, confirmParams: { return_url }, redirect })` | P0 |
| CFM-003 | `nexus.confirmSetup({ elements, clientSecret, confirmParams: { return_url } })` | P1 |
| CFM-004 | `nexus.initEmbeddedCheckout({ clientSecret })` → `{ mount, unmount, destroy }` | P1 |
| CFM-005 | 结果状态机：`succeeded` / `processing` / `requires_action` / `requires_payment_method` / `canceled` | P0 |
| CFM-006 | `redirect: 'always' \| 'if_required'` | P0 |
| CFM-007 | 错误对象：`{ type, code, message, decline_code? }` — 与 Stripe 结构对齐 | P0 |

### 5.3 事件系统

```typescript
interface ChangeEvent {
  complete: boolean;           // 填写完整
  empty: boolean;              // 为空
  valid: boolean;              // 校验通过
  elementType: ElementType;
  brand?: CardBrand;           // Card 类专属
  error?: ElementError;
  value?: Record<string, string>;  // 脱敏后的展示值
}

interface ElementError {
  type: 'invalid_number' | 'invalid_expiry' | 'invalid_cvc'
      | 'incomplete_number' | 'incomplete_expiry' | 'incomplete_cvc'
      | 'invalid_iban' | 'incomplete_iban' | 'validation_error' | 'network_error';
  message: string;
  code?: string;
}
```

事件清单：`ready` / `change` / `focus` / `blur` / `input` / `error` / `escape` / `click` / `confirm` / `cancel` / `loaderror`

### 5.4 主题与外观系统（Appearance）

```typescript
interface Appearance {
  theme?: 'stripe' | 'flat' | 'night' | 'none';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorTextSecondary?: string;
    colorDanger?: string;
    colorSuccess?: string;
    colorBorder?: string;
    colorBorderFocus?: string;
    borderRadius?: string;
    fontFamily?: string;
    fontSizeBase?: string;
    fontSizeSm?: string;
    spacingUnit?: string;
    gridGutter?: string;
  };
  rules?: {
    '.Input': CSSProperties;
    '.Input--focus': CSSProperties;
    '.Input--error': CSSProperties;
    '.Label': CSSProperties;
    '.Error': CSSProperties;
    '.Tab': CSSProperties;
    '.Tab--selected': CSSProperties;
    '.Block': CSSProperties;
    '.Radio': CSSProperties;
    '.Icon': CSSProperties;
  };
}
```

Element 级 `style` 选项（对标 Stripe）：`base` / `complete` / `empty` / `invalid` / `focus` / `disabled` 状态样式对象。

### 5.5 Iframe 安全隔离

```
商户页面 (merchant.com)
┌──────────────────────────────────────────────┐
│  <div id="card-element"></div>                │
│  ┌────────────────────────────────────────┐  │
│  │  <iframe src="fields.nexuspay.com/.."> │  │
│  │  [敏感数据在此收集，永不接触商户 JS]      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

通信: 商户 SDK ←─postMessage(HMAC签名)─→ Element Iframe
```

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| SEC-001 | 所有敏感字段（卡号/CVC/IBAN/银行账号）在独立 iframe 内渲染 | P0 |
| SEC-002 | postMessage 消息 HMAC-SHA256 签名校验 | P0 |
| SEC-003 | iframe `sandbox` 属性限制权限（allow-forms allow-scripts，禁 top-navigation） | P0 |
| SEC-004 | 敏感数据永不返回商户页面（仅返回 token / 元数据） | P0 |
| SEC-005 | 生产环境 iframe src 来自独立域（如 `fields.nexuspay.com`）；开发模式支持 srcdoc 内联 | P0 |
| SEC-006 | CSP (Content-Security-Policy) 配置 | P0 |
| SEC-007 | 点击劫持防护（`X-Frame-Options: DENY` 于 fields 域） | P0 |
| SEC-008 | 输入数据不写入 localStorage / sessionStorage / cookie | P0 |
| SEC-009 | CDN 分发 script 携带 SRI integrity + crossorigin="anonymous" | P0 |

#### Token 化

| 需求ID | 描述 | 优先级 |
|--------|------|--------|
| TOK-001 | 提交时字段层将原始数据加密传输至商户后端/网关，换取一次性 token（`pm_xxx` / `tok_xxx`） | P0 |
| TOK-002 | 加密方案：TLS + 应用层 RSA/AES 混合加密（公钥由服务端下发） | P0 |
| TOK-003 | token 单次有效、5 分钟过期、绑定商户密钥 | P0 |
| TOK-004 | change 事件仅暴露 `complete` / `empty` / `error` / `brand`，不暴露原始值 | P0 |

### 5.6 表单校验框架

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  type: 'required' | 'format' | 'length' | 'range' | 'luhn' | 'mod97' | 'expired';
  message: string;
}

// 校验器注册表
const validators = {
  cardNumber: (value, brand?) => { /* 去噪 → 长度(brand) → Luhn */ },
  cardExpiry: (value) => { /* MM/YY 格式 → 月份 1-12 → 未过期 */ },
  cardCvc: (value, brand?) => { /* 长度随品牌 */ },
  iban: (value) => { /* 国家码 → 长度 → MOD-97 */ },
  bsb: (value) => { /* 澳洲 BSB 6位 */ },
  postalCode: (value, country) => { /* 国家特定格式 */ },
};
```

### 5.7 国际化

```typescript
type SupportedLocale =
  | 'en' | 'zh' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'it'
  | 'pt' | 'nl' | 'pl' | 'da' | 'sv' | 'no' | 'fi' | 'ru'
  | 'ar' | 'hi' | 'th' | 'vi' | 'id' | 'ms' | 'tr';

// 200+ key，覆盖所有组件文案
interface I18nMessages {
  'card.number': string;       // 'Card number' / '卡号'
  'card.expiry': string;       // 'Expiry' / '有效期'
  'card.cvc': string;          // 'CVC'
  'card.invalid': string;      // 'Your card number is invalid.'
  'card.incomplete': string;   // 'Your card number is incomplete.'
  'expiry.past': string;       // 'Your card's expiration date is in the past.'
  'ideal.select': string;      // 'Select your bank'
  'iban.invalid': string;      // 'Invalid IBAN'
  'address.required': string;  // 'This field is required'
  // ...
}
```

首期交付 `en` + `zh`，其余语言提供 key 框架后续补充。

---

## 六、API 设计

### 6.1 原生 JS 接入

```typescript
import { loadNexus } from '@nexus-elements/core';

const nexus = await loadNexus('pk_test_xxx');

const elements = nexus.elements({
  appearance: { theme: 'stripe', variables: { colorPrimary: '#635BFF' } },
  locale: 'zh',
  clientSecret: 'pi_xxx_secret_xxx',
});

const card = elements.create('card', {
  style: { base: { fontSize: '16px' } },
  hidePostalCode: true,
});
card.mount('#card-element');

card.on('change', (event) => {
  console.log(event.complete, event.error);
});

const { error, paymentIntent } = await nexus.confirmCardPayment(clientSecret, {
  payment_method: { card, billing_details: { name: 'John Doe' } },
});
```

### 6.2 Vue 适配层接入

```vue
<template>
  <NexusElements :publishable-key="pk" :options="elementsOptions">
    <NexusPaymentElement :options="{ layout: 'tabs' }" @change="onChange" />
    <button :disabled="!complete" @click="pay">Pay</button>
  </NexusElements>
</template>

<script setup lang="ts">
import { NexusElements, NexusPaymentElement, useNexus, useElements } from '@nexus-elements/vue';

const { nexus } = useNexus();
const elements = useElements();

async function pay() {
  const { error } = await nexus.confirmPayment({
    elements,
    confirmParams: { return_url: window.location.href },
  });
}
</script>
```

Vue 适配层组件清单：

| 组件 | 说明 |
|------|------|
| `<NexusElements>` | Provider — 初始化 SDK + 注入 |
| `<NexusPaymentElement>` | Payment Element |
| `<NexusCardElement>` | Card（合并/拆分 mode prop） |
| `<NexusCardNumberElement>` | 独立卡号 |
| `<NexusCardExpiryElement>` | 独立有效期 |
| `<NexusCardCvcElement>` | 独立 CVC |
| `<NexusExpressCheckoutElement>` | 快捷支付 |
| `<NexusAddressElement>` | 地址 |
| `<NexusIbanElement>` | IBAN |
| `<NexusIdealBankElement>` | iDEAL |
| ... | 其余 Element 一一对应 |

Composables：`useNexus()` / `useElements()` / `useElement(type, options)` / `useConfirm()`

---

## 七、Element 实例 API 汇总

```typescript
type ElementType =
  | 'payment' | 'card' | 'cardNumber' | 'cardExpiry' | 'cardCvc'
  | 'expressCheckout' | 'address' | 'idealBank' | 'iban'
  | 'auBankAccount' | 'fpxBank' | 'epsBank' | 'p24Bank'
  | 'paymentMethodMessaging' | 'afterpayClearpay'
  | 'linkAuthentication' | 'cart' | 'order' | 'walletButton';

interface NexusElement {
  mount(domElement: string | HTMLElement): NexusElement;
  unmount(): void;
  destroy(): void;
  update(options: Partial<ElementOptions>): Promise<void>;
  focus(): void;
  blur(): void;
  clear(): void;
  on(event: string, handler: Function): NexusElement;
  off(event: string, handler?: Function): NexusElement;
  collapse?: () => void;              // Payment Element accordion
  fetchUpdates?: () => Promise<void>; // Cart / Order
}
```

---

## 八、示例应用（examples/）

Vue + Vite 应用，逐页对标 stripe-element-example 的 12 个 demo 交互行为：

| # | 示例页 | 对标原页面 | 核心演示点 | 优先级 |
|---|--------|-----------|-----------|--------|
| 1 | 首页导航 | index.html | 示例网格 | P0 |
| 2 | 合并卡片 | card-element-classic.html | 单字段 card、逐字段错误 | P0 |
| 3 | 拆分卡片 | card-element.html | 三字段 + 品牌图标 | P0 |
| 4 | Payment Element 完整版 | payment-element.html | 币种/金额/模式切换/Update | P0 |
| 5 | Payment Element 简化版 | payment-simple.html | tabs 布局最简流程 | P0 |
| 6 | APM + Prefill | payment-element-apm.html | 支付方式 chips + 预填 | P1 |
| 7 | 快捷支付 | express-checkout.html | 钱包按钮 + 可用性检测 | P1 |
| 8 | 嵌入式结账 | embedded-checkout.html | 托管页内嵌 | P1 |
| 9 | 重定向结账 | checkout-redirect.html | 跳转 + return URL 解析 | P1 |
| 10 | 订阅支付 | billing-*.html | 月/年套餐 | P2 |
| 11 | 保存卡片 | setup-intent.html | SetupIntent 流程 | P1 |
| 12 | 银行转账类 | — | iDEAL / IBAN / FPX 演示 | P2 |

示例应用共享设计语言（对标原 style.css）：紫色渐变背景（#667eea→#764ba2）、白色圆角卡片、渐变按钮 + spinner。

---

## 九、非功能需求 / 质量要求

| 指标 | 目标 |
|------|------|
| SDK core 体积 | < 50KB gzip |
| Element iframe 加载 | < 200ms |
| 支付方式切换响应 | < 100ms |
| 输入延迟 (keystroke → display) | < 16ms (60fps) |
| 浏览器兼容 | Chrome 90+ / Firefox 88+ / Safari 14+ / Edge 90+ / iOS Safari 14+ / Android Chrome |
| 测试覆盖率 | 单元 > 85%，E2E 核心流程 100% |
| 可访问性 | WCAG 2.1 AA（aria-label / aria-live 错误播报 / 键盘可达） |
| TypeScript | Strict mode，零 `any` |
| Tree-shaking | 组件按需导入 |
| 安全 | SEC-001 ~ SEC-009 全部达标 |

---

## 十、开发计划

### Phase 1: 核心基础 (Week 1-4)

| 任务 | 产出 |
|------|------|
| Monorepo 骨架（pnpm + Vite + TS + Vitest） | 可运行工程 |
| SDK 基础架构 + iframe 通信框架（postMessage + HMAC） | 通信骨架 |
| 主题系统（CSS Variables 引擎 + 4 套预设主题） | Appearance 可用 |
| 事件系统 + 校验框架（校验器注册表） | 通用能力 |
| Card Element（合并）+ CardNumber / CardExpiry / CardCvc | 卡支付全字段 |
| confirmCardPayment 全链路 | 支付闭环 |
| examples: 首页 + 合并卡片 + 拆分卡片 | 可演示 |

### Phase 2: 聚合支付 (Week 5-8)

| 任务 | 产出 |
|------|------|
| Payment Element（动态子表单 + tabs/accordion/radio） | 核心聚合组件 |
| confirmPayment / confirmSetup / redirect 处理 | 确认矩阵 |
| Express Checkout Element + Wallet Button | 钱包按钮 |
| Address Element（国家字段规则表） | 地址收集 |
| Vue 适配层全量组件 | @nexus-elements/vue |
| examples: Payment Element 完整/简化 + APM Prefill | 可演示 |

### Phase 3: 银行与区域支付 (Week 9-12)

| 任务 | 产出 |
|------|------|
| Ideal Bank / Fpx Bank / Eps Bank / P24 Bank | 银行选择器×4 |
| Iban Element（MOD-97 + 75国规则） | IBAN |
| Au Bank Account Element | BECS |
| Embedded Checkout / Redirect Checkout | 托管结账 |
| examples: 银行转账类 + 结账类 | 可演示 |

### Phase 4: 辅助组件 + 生态 (Week 13-16)

| 任务 | 产出 |
|------|------|
| Link Authentication Element（OTP 流程） | 快捷登录 |
| Payment Method Messaging / Afterpay Clearpay | BNPL 消息 |
| Cart Element / Order Element | 展示类组件 |
| i18n 全量 24 语言 | 国际化 |
| E2E 测试套件（Playwright） | 质量保障 |
| Storybook 文档站 + API Reference | 文档 |
| 性能优化达标 | < 50KB gzip |

---

## 十一、验收标准

1. 全部 19 个 Element 组件实现并通过功能测试
2. 敏感数据 100% 在 iframe 内处理，商户页面 JS 无法读取卡号原文
3. 4 套预设主题 + 自定义 variables/rules 覆写生效
4. 原生 JS + Vue 两种接入方式可用（React 后续）
5. 首期 en/zh 双语完整，i18n 框架支持 24 语言扩展
6. 全部主流卡品牌 BIN 检测 + Luhn 校验正确
7. 性能指标达标（SDK < 50KB gzip，输入延迟 < 16ms）
8. WCAG 2.1 AA 可访问性审计通过
9. 示例应用交互行为与原 stripe-element-example 逐页对照通过
10. TypeScript strict 零错误，单元测试覆盖率 > 85%
