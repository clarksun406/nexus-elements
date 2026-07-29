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
| [Phase 4：辅助组件 + 生态](#phase-4辅助组件--生态) | ✅ 完成 | 辅助组件、CDN 加载、i18n（10 locale）、Storybook、Element 级样式、校验器注册表、WCAG、单测 169 |
| [Phase 5（规划）](#phase-5规划) | ⬜ 未开始 | 生产部署项、真实品牌图标、字体加载、更多 locale |

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
| 包体积 | SDK 总计 66.3 KB gzip（core 5.2 + fields JS 51 + CSS 4.4） |

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
| 应用层加密 | P1 | TOK-002：`/v1/encryption_key` 端到端加密（当前为 stub） |
| 后端 Mock 模块 | P1 | 本地 Mock Server 模拟 Stripe API（PaymentIntent / SetupIntent / Confirm / 3DS），支持 e2e 脚本与 Storybook 独立测试，无需真实密钥 |
| 真实品牌图标 | P2 | CE-003：替换文字徽标为 SVG/PNG logo |
| 字体加载 | P2 | `fonts` 选项：自定义 Web Font 注入 iframe |
| 更多 locale | P2 | 从 10 种扩展至 23 种（i18n 框架已就绪，仅需翻译） |
| postal code 字段 | P3 | CE-008：Card 组件内嵌 postal code 输入 |

---

## 验证里程碑

| 指标 | 当前 | 目标 |
|------|------|------|
| 单元测试 | 169 | 维持 > 150 |
| E2E 脚本 | 18 个 Playwright | 覆盖全部 19 组件 |
| TypeScript | 4 包 strict 零错误 | 维持 |
| 包体积 | 66.3 KB gzip | < 80 KB（自动校验） |
| Storybook | 9 分类 / 60+ 变体 | 维持 |
| 组件覆盖 | 19 / 19 | ✅ 达成 |
| i18n locale | 10 种 | 按需扩展 |
