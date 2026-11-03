# Nexus Elements — Roadmap

> 项目里程碑与功能演进路线。详细实现状态见 [implementation-status.md](implementation-status.md)。
> 更新日期：2026-07-28

---

## 总体目标

构建仿 Stripe Elements 的支付 UI 组件库：敏感字段 sandboxed iframe 隔离（PCI-DSS）、HMAC 签名 postMessage 桥、框架无关核心 + Vue 3 一等公民适配层、19 种支付组件全覆盖。

---

## 阶段总览

| 阶段 | 状态 | 核心交付 |
|------|------|---------|
| [Phase 1：核心基础](#phase-1核心基础) | ✅ 完成 | SDK 骨架、iframe 桥、主题引擎、Card 全组件、confirmCardPayment 全链路 |
| [Phase 2：聚合支付](#phase-2聚合支付) | ✅ 完成 | Payment Element、Express Checkout、Address、Embedded Checkout |
| [Phase 3：银行与区域支付](#phase-3银行与区域支付) | ✅ 完成 | 6 种银行组件、Redirect Checkout、银行 E2E |
| [Phase 4：辅助组件 + 生态](#phase-4辅助组件--生态) | ✅ 完成 | 辅助组件、CDN 加载、i18n（23 locale，232 条文案）、Storybook 58 stories、校验器含 postalCode、单测 226 |
| [Phase 5（规划）](#phase-5规划) | 🔶 进行中 | 生产部署项、品牌图标 ✅、字体加载 ✅、locale 扩展 ✅、postal code ✅ |
| [Phase 6：Appearance API 增强](#phase-6appearance-api-增强) | ✅ 完成 | 变量 14→21 ✅、规则选择器 10→18 ✅、placeholder/icon CSS 变量化 ✅ |

---

## Phase 1：核心基础 ✅

**目标**：搭建 SDK 框架与支付主链路。

| 能力 | 说明 |
|------|------|
| Monorepo 架构 | pnpm workspace，4 包（core / fields / vue / examples） |
| iframe 安全桥 | HMAC-SHA256 双向签名（Web Crypto + CryptoKey 缓存），`sig_<64hex>` 格式 |
| 主题引擎 | 4 套预设（stripe / flat / night / none）+ CSS 变量 + rules 选择器注入 |
| 校验框架 | Luhn、品牌 BIN 检测、MM/YY 过期、CVC 长度随品牌（55 单测） |
| Card 组件 | 合并卡 + 拆分三字段（cardNumber / cardExpiry / cardCvc），格式化 / 粘贴 / 品牌图标 |
| 确认链路 | `confirmCardPayment` → tokenize → POST /v1/payment_intents/confirm → 3DS 自动跳转 |
| Vue 适配层 | NexusElementsProvider + 具名组件 + composables（useNexus / useElements / useElement） |
| 包体积 | 计量合计 47.14 KB gzip（core ESM 7.11 + IIFE 6.43 + fields 入口 33.48 + 共享 CSS 0.11）。字段按组件与语言拆包 |

---

## Phase 2：聚合支付 ✅

**目标**：聚合支付方式 + 高级确认流程。

| 能力 | 说明 |
|------|------|
| Payment Element | tabs / accordion / radio 三布局，卡 + 重定向子表单，savedPaymentMethods，billingDetails 收集 |
| Express Checkout | Apple Pay / Google Pay / PayPal / Link 按钮，可用性检测，confirm → complete 状态机 |
| Address Element | 国家动态字段（state/city/postal），shipping/billing 模式，邮编校验 |
| Embedded Checkout | 托管结账页 `/embedded-checkout`，mount/unmount/destroy + onComplete postMessage |
| confirmPayment | 双路径：elements tokenize + paymentMethodId 直接确认（钱包流程） |
| confirmSetup | SetupIntent 保存卡片 |
| redirect 控制 | `redirect: 'if_required'` 抑制自动 3DS 跳转 |
| E2E 覆盖 | 8 个 Playwright 脚本（card / split / 3DS / payment / express / embedded / setup / address） |

---

## Phase 3：银行与区域支付 ✅

**目标**：欧洲 / 东南亚 / 澳洲银行支付全覆盖。

| 能力 | 说明 |
|------|------|
| iDEAL | 13 家荷兰银行，搜索过滤 + 首字母图标 |
| FPX | 17 家马来西亚银行，online/offline 状态 |
| EPS | 23 家奥地利银行 |
| P24 | 28 家波兰银行 |
| IBAN | 75+ 国家长度规则，MOD-97 校验，自动格式化 |
| BECS（Au Bank Account） | BSB + 账号 + 姓名 + 邮箱 |
| Redirect Checkout | 订单页 → 跳转托管结账 → 支付 → 回跳成功页 |
| 银行 E2E | `e2e-bank-transfer.py` 覆盖 6 组件 tab 切换 + 选择/输入 + change 事件 |

---

## Phase 4：辅助组件 + 生态 ✅

**目标**：补齐 19 组件 + 开发者体验 + 生态工具。

| 能力 | 说明 |
|------|------|
| 辅助组件（10 种） | PaymentMethodMessaging / LinkAuthentication / Cart / Order / AfterpayClearpay / WalletButton — 全部实现 |
| CDN 加载器 | `loadScript({ url, integrity, retries })`：去重、指数退避重试、SRI（11 单测） |
| 包体积校验 | `scripts/verify-bundle.mjs` 自动测量 + SHA-384 SRI 哈希生成 + 超限报警 |
| i18n（10 locale） | 86 翻译键 × 10 语言（en/zh/ja/ko/de/fr/es/it/pt/nl），前缀匹配 locale 解析（27 单测） |
| Storybook | 9 个分类（Card / CardSplit / Payment / ExpressCheckout / Address / BankTransfer / Supplementary / Theming / ElementStyles），60+ 变体 |
| Element 级 style | `ElementStyle` 状态样式对象（base/empty/focus/invalid/complete/disabled），`useElementStyle` 组合式函数，Card / CardNumber / CardExpiry / CardCvc / IBAN 支持 |
| 组件全量 | **19 / 19** 组件全部实现 |
| 校验器注册表 | `registerValidator(type, fn)` / `validate(type, value, context?)`，预置 5 种校验器，支持商户自定义（11 单测） |
| WCAG 2.1 AA | aria-label / aria-invalid / aria-checked / role / tabindex / focus-visible / 键盘导航 全面审计修复 |
| 单测补齐 | 169 个测试（+75）：element 生命周期 24 / useCardInputs 13 / 校验器注册表 11 / i18n 27 |
| brand 传播 | cardNumber → cvc 跨 iframe 自动传播（`nexus:brand` 桥消息） |

---

## Phase 5（规划） ⬜

**目标**：生产部署 + 视觉增强。

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 生产独立域部署 | P0 | SEC-005：fields 独立域部署（非同源），SEC-006/007 CSP + X-Frame-Options |
| 应用层加密 | ✅ | TOK-002：字段层 RSA-OAEP + AES-256-GCM，公钥来自 `GET /v1/encryption_key`。详见 docs/security.md |
| 后端 Mock 模块 | P1 ✅ | `@nexus-elements/mock-api` 独立包：Vite 插件 / 独立 HTTP 服务器 / Storybook 集成，MockStore 状态重置，13 路由全覆盖 |
| 真实品牌图标 | P2 ✅ | CE-003：10 个卡品牌内联 SVG 图标，`v-html` 渲染，💳 未知品牌 fallback |
| 字体加载 | P2 ✅ | `fonts` 选项：`@font-face` CSS 注入 iframe，`--nexus-font-family` 自动设置 |
| 更多 locale | P2 ✅ | 从 10 种扩展至 23 种（新增 pl/da/sv/no/fi/ru/ar/hi/th/vi/id/ms/tr） |
| postal code 字段 | P3 ✅ | CE-008：Card 组件内嵌 postal code 输入，`hidePostalCode` 控制显隐，tokenize 注入 `billing_details.address.postal_code` |

---

## Phase 6：Appearance API 增强 ✅

**目标**：对齐 Stripe Appearance API 全部能力，补齐缺失的变量、规则选择器与 Element 样式属性。

### 当前已有（14 变量 + 10 选择器 + 6 状态样式）

| 类别 | 已实现 |
|------|--------|
| 变量 | `colorPrimary` `colorBackground` `colorText` `colorTextSecondary` `colorDanger` `colorSuccess` `colorBorder` `colorBorderFocus` `borderRadius` `fontFamily` `fontSizeBase` `fontSizeSm` `spacingUnit` `gridGutter` |
| 规则选择器 | `.Input` `.Input--focus` `.Input--error` `.Label` `.Error` `.Tab` `.Tab--selected` `.Block` `.Radio` `.Icon` |
| Element 样式 | `base` / `empty` / `complete` / `invalid` / `focus` / `disabled` 6 状态，23 属性 |

### 6.1 新增变量（+7）

| 变量 | 说明 | 优先级 |
|------|------|--------|
| `colorWarning` | 警告色（Stripe 有，我们仅有 danger/success） | P1 |
| `colorTextPlaceholder` | 占位符文字色（当前硬编码在各组件 CSS 中） | P1 |
| `colorIcon` | 图标色（品牌图标、锁图标等） | P2 |
| `colorIconCheckmark` | 勾选图标色（完成状态的 ✓ 图标） | P2 |
| `spacingTab` | Tab 组件专用间距 | P2 |
| `spacingGridRow` | 网格行间距 | P3 |
| `spacingGridColumn` | 网格列间距 | P3 |

**实现**：
- `packages/core/src/types/index.ts` — `AppearanceVariables` 接口新增 7 个可选字段
- `packages/core/src/theme/index.ts` — `VARIABLE_MAP` 新增映射（`--nexus-color-warning` / `--nexus-color-placeholder` / `--nexus-color-icon` / `--nexus-color-icon-checkmark` / `--nexus-spacing-tab` / `--nexus-spacing-grid-row` / `--nexus-spacing-grid-column`）
- 4 套预设主题中为新增变量补充默认值
- 各组件 CSS 中将硬编码的 placeholder 色等替换为 `var(--nexus-color-text-placeholder, #8792a2)`

### 6.2 新增规则选择器（+8）

| 选择器 | 说明 | 优先级 |
|--------|------|--------|
| `.Input:hover` | 输入框悬停态 | P1 |
| `.Input--disabled` | 输入框禁用态 | P1 |
| `.Tab:hover` | Tab 悬停态 | P2 |
| `.AccordionItem` | 手风琴项 | P2 |
| `.Checkbox` | 复选框容器 | P2 |
| `.CheckboxInput` | 复选框输入 | P2 |
| `.CheckboxInput--checked` | 复选框选中态 | P2 |
| `.CheckboxInput:focus` | 复选框焦点态 | P2 |

**实现**：
- `packages/fields/src/appearance.ts` — `RULE_SELECTOR_MAP` 新增 8 个映射
- 各组件模板中确保对应 CSS class 存在（如 `.nexus-input:hover` 已自然支持，`.nexus--disabled .nexus-input` 已有）
- `.AccordionItem` 映射到 Payment Element 的 accordion 布局项
- `.Checkbox` 系列映射到 Payment Element 的 savedPaymentMethods 复选框

### 6.3 Element 样式属性补齐

当前 `ElementStyleState` 已有 23 属性，Stripe 还支持少量额外属性：

| 属性 | 说明 | 优先级 |
|------|------|--------|
| `outline` | 焦点轮廓 | P2 |
| `outlineOffset` | 轮廓偏移 | P3 |
| `zIndex` | 层级（用于 focus 时提升） | P3 |

**实现**：
- `packages/fields/src/composables/useElementStyle.ts` — 属性列表已用索引签名 `[key: string]` 兜底，仅需确保 kebab-case 转换覆盖新增属性

### 6.4 主题预设更新

4 套预设主题需为新增变量补充合理默认值：

| 变量 | stripe | flat | night | none |
|------|--------|------|-------|------|
| `colorWarning` | `#df1b41` | `#e68600` | `#ff8c5a` | `transparent` |
| `colorTextPlaceholder` | `#8792a2` | `#8792a2` | `#8c95a8` | `transparent` |
| `colorIcon` | `#8792a2` | `#8792a2` | `#8c95a8` | `transparent` |
| `colorIconCheckmark` | `#30b130` | `#0570de` | `#73f0a0` | `transparent` |

### 6.5 示例与 E2E 覆盖 ✅

**新增 `/appearance` 示例页**（Appearance Playground）：
- 主题切换（4 套预设）
- 语言切换（8 种 locale）
- 字体切换（System / Inter / Roboto Mono）
- 自定义变量（colorPrimary / colorBackground / colorText / colorDanger / borderRadius / fontSizeBase）
- 规则覆写（8 个选择器开关）
- Element 级样式（per-element style 开关）
- API 方法按钮（focus / blur / clear）
- 实时事件日志（focus / blur / error / escape / click / change）

**增强 `/card-combined` 示例页**：
- `hidePostalCode` 开关
- `disabled` 开关
- `focus()` / `blur()` / `clear()` 方法按钮
- 事件日志面板

**新增 `e2e-appearance.py`**：覆盖主题/变量/规则/字体/语言/元素样式/方法/事件。

**增强 `e2e-card-combined.py`**：新增 postal code 输入、hidePostalCode 切换、disabled 切换、focus/blur/clear 方法、事件日志验证。

---

## 验证里程碑

| 指标 | 当前 | 目标 |
|------|------|------|
| 单元测试 | 226（core 90 / fields 131 / vue 2 / mock-api 3） | 行覆盖 core 96.7%、fields 87.0% |
| E2E | 17 个 `@playwright/test`（`tests/e2e/*.spec.ts`） | `pnpm e2e` 自动启动 dev server；含伪造 / 跨源 postMessage |
| TypeScript | 4 包 strict 零错误 | 维持 |
| 包体积 | 66.3 KB gzip | < 80 KB（自动校验） |
| Storybook | 9 分类 / 60+ 变体 | 维持 |
| 组件覆盖 | 19 / 19 | ✅ 达成 |
| i18n locale | 10 种 | 按需扩展 |
