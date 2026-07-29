# Nexus Elements — 实现状态总结

> 对照 `docs/requirements.md` 的原始需求，记录当前实现进度、改动点与遗留缺口。
> 项目路线图与阶段里程碑见 [roadmap.md](roadmap.md)。
> 更新日期：2026-07-28

---

## 一、总体进度

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1：核心基础 | ✅ 完成 | Monorepo、iframe 桥（HMAC-SHA256）、主题引擎、校验框架、Card 全字段、confirmCardPayment 全链路（含 3DS） |
| Phase 2：聚合支付 | ✅ 完成 | Payment Element ✅、确认矩阵 ✅、Express Checkout ✅、Address Element ✅、PE 增强 ✅、Embedded Checkout ✅ |
| Phase 3：银行与区域支付 | ✅ 完成 | iDEAL ✅、FPX ✅、EPS ✅、P24 ✅、IBAN ✅、BECS ✅、Redirect Checkout ✅、银行 E2E ✅ |
| Phase 4：辅助组件 + 生态 | ✅ 完成 | 全部 19 组件 ✅；CDN 加载器 + SRI ✅；i18n（10 locale）✅；Storybook ✅（9 个分类，60+ 变体）；校验器注册表 ✅；WCAG 2.1 AA ✅；单测 169 ✅ |

**组件进度：19 / 19**（card、cardNumber、cardExpiry、cardCvc、payment、expressCheckout、address、idealBank、fpxBank、epsBank、p24Bank、iban、auBankAccount、paymentMethodMessaging、linkAuthentication、cart、order、afterpayClearpay、walletButton）

**验证状态：** 169 个单元测试通过 · 18 个 Playwright E2E 脚本通过 · 4 包 TypeScript strict 零错误 · 全量构建通过 · 包体积自动校验（`scripts/verify-bundle.mjs`）

---

## 二、需求覆盖矩阵

图例：✅ 已实现 · 🔶 部分实现 · ⬜ 未开始

### 5.1 SDK 入口与生命周期

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| SDK-001 | ✅ | `createNexus(pk)`，`pk_test_`/`pk_live_` 格式校验（`packages/core/src/loader.ts`，有单测） |
| SDK-002 | ✅ | npm ESM ✅；IIFE 包（`dist/nexus-core.iife.js`，5.2 KB gzip）✅；CDN 分发 + SRI 集成 ✅ |
| SDK-003 | ✅ | `loadScript({ url, integrity, retries })`：去重（window.Nexus + 已有 script 标签）、指数退避重试（默认 3 次）、SRI 支持（11 个单测，`packages/core/src/loader.test.ts`） |
| SDK-004 | ✅ | `nexus.elements(options)` 共享 appearance / locale / clientSecret |
| SDK-005 | ✅ | `elements.create(type)` 全部 19 种 type 均有真实字段组件 |
| SDK-006 | ✅ | `mount(selector \| HTMLElement)` 创建 sandboxed iframe |
| SDK-007 | ✅ | `unmount()` / `destroy()` 清理监听、iframe、桥注册 |
| SDK-008 | ✅ | `update(options)` 运行时更新（经 `nexus:update` 桥消息） |
| SDK-009 | ✅ | `clear()` / `focus()` / `blur()` |
| SDK-010 | ✅ | `on()` / `off()`，11 种事件类型已定义（confirm/cancel/loaderror 本轮补齐转发） |
| SDK-011 | ⬜ | `nexusAccount` 平台代收预留（P2） |

### 5.2 支付确认 API

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| CFM-001 | ✅ | `confirmCardPayment(clientSecret, {payment_method:{card}})`，含 return_url 与 3DS 自动重定向 |
| CFM-002 | ✅ | `confirmPayment({elements, clientSecret, confirmParams})`；**新增** `confirmPayment({clientSecret, paymentMethodId})` 直接确认路径（钱包流程） |
| CFM-003 | ✅ | `confirmSetup({elements, clientSecret, confirmParams})` 已实现（E2E 待补） |
| CFM-004 | ✅ | `initEmbeddedCheckout` 完整实现：mount/unmount/destroy + 托管结账页 `/embedded-checkout` 示例 |
| CFM-005 | ✅ | 状态机在 mock API 完整实现：requires_payment_method → requires_action → succeeded / canceled |
| CFM-006 | ✅ | `redirect: 'if_required'` 控制 3DS 跳转 |
| CFM-007 | ✅ | 错误对象 `{type, code, message, decline_code?, payment_intent?}` 与 Stripe 对齐 |

### 5.5 Iframe 安全隔离 & Token 化

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| SEC-001 | ✅ | 所有敏感字段渲染于独立 iframe（`sandbox="allow-scripts allow-same-origin allow-forms"`） |
| SEC-002 | ✅ | postMessage 双向 HMAC-SHA256 签名（Web Crypto，CryptoKey 缓存，`sig_<64hex>`），双端校验 |
| SEC-003 | 🔶 | sandbox 已限制权限；`allow-same-origin` 因同源 mock 保留（生产需独立域，见 SEC-005） |
| SEC-004 | ✅ | 商户页仅获得 token / 元数据。**注意**：拆分字段分组时原始分段经父页面桥内存中转（与 Stripe 架构一致，不暴露给商户代码） |
| SEC-005 | 🔶 | `fieldsUrl` 可配置指向独立部署；生产独立域 / 开发 srcdoc 未实现 |
| SEC-006 | ⬜ | CSP 配置（属服务端部署项） |
| SEC-007 | ⬜ | fields 域 X-Frame-Options（属服务端部署项） |
| SEC-008 | ✅ | 字段层无任何 localStorage / sessionStorage / cookie 写入 |
| SEC-009 | ✅ | `scripts/verify-bundle.mjs` 自动生成 SHA-384 SRI 哈希；`loadScript({ integrity })` 设置 `script.integrity` + `crossOrigin` |
| TOK-001 | ✅ | iframe 内 POST `/v1/tokens` 换取一次性 token（`tok_test_*` / `pm_test_*`） |
| TOK-002 | 🔶 | 仅 TLS；应用层加密 stub（`/v1/encryption_key` 返回 `ek_test_disabled` 占位） |
| TOK-003 | ✅ | mock 强制：token 单次有效、5 分钟过期、重复使用报 `token_already_used` |
| TOK-004 | ✅ | change 事件仅暴露 complete / empty / valid / error / brand / paymentMethodType |

### 4.2 Card Element（合并）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| CE-001 | ✅ | 4-4-4-4 / Amex 4-6-5 格式化（`validation/format.ts`，含光标保持） |
| CE-002 | ✅ | BIN 品牌实时检测（visa/mastercard/amex/discover/jcb/unionpay/diners，`validation/brands.ts`） |
| CE-003 | 🔶 | 品牌以文字徽标展示（非真实 logo 图） |
| CE-004 | ✅ | MM / YY 自动格式化 + 过期校验（不早于当月、不超 20 年） |
| CE-005 | ✅ | CVC 长度随品牌（Amex 4 位） |
| CE-006 | ✅ | invalid / incomplete 区分 + 行内错误提示 |
| CE-007 | 🔶 | Enter 跨段、Esc 事件已做；退格跨段回退 / 方向键导航未完整 |
| CE-008 | 🔶 | `showIcon`/`hideIcon` ✅；postal code 字段本身未实现 |
| CE-009 | ✅ | 整卡粘贴自动拆分到号/期/码三段 |
| CE-010 | ✅ | `disabled` 状态 |
| CE-011 | ✅ | `inputmode="numeric"` |

### 4.3–4.5 拆分 Card 子组件

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| CN-001~004 | ✅ | 独立卡号 + 格式化 + Luhn + 品牌图标 + placeholder |
| CX-001~003 | ✅ | 独立有效期 + 自动补 `/` + 过期校验 + placeholder |
| CC-001 | ✅ | 独立 CVC 密码式显示 |
| CC-002 | ✅ | 长度随品牌逻辑已有；**brand 跨 iframe 自动传播**（cardNumber → cvc 经 `nexus:brand` 自动同步） |
| CC-003 | ✅ | placeholder 自定义 |
| —（分组） | ✅ | **本轮新增**：同一 elements 实例下 cardNumber/cardExpiry/cardCvc 自动成组，tokenize 时经 `nexus:collect-data`/`nexus:collect-result` 聚合为完整卡对象（mock 已强制完整卡，E2E 实证） |

### 4.1 Payment Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| PE-001 | ✅ | 按 `paymentMethods` 配置渲染选择器（默认 card + ideal） |
| PE-002 | ✅ | tabs / accordion / radio 三布局（E2E 全覆盖） |
| PE-003 | ✅ | 切换方式动态渲染子表单（卡子表单复用 `useCardInputs`；重定向方式为银行选择） |
| PE-004 | ✅ | `defaultPaymentMethod` |
| PE-005 | ✅ | 按 `country` 过滤（currency 匹配规则在 `PaymentField.vue` 内） |
| PE-006 | ✅ | 已保存支付方式列表渲染 + 切换（`savedPaymentMethods` 选项） |
| PE-007 | ⬜ | 内嵌 Link Authentication（P2） |
| PE-008 | ✅ | change / ready / focus / blur 事件（change 携带 `paymentMethodType`） |
| PE-009 | ✅ | tokenize 前校验子表单，错误经 `nexus:token-result` 返回 |
| PE-010 | ✅ | billingDetails 字段控制（`auto`/`never`/`optional`/`required`） |
| PE-011 | ✅ | defaultValues 预填（billingDetails 各字段） |
| PE-012 | ✅ | 运行时更新不重建组件（options 深监听 → `nexus:update` 合并） |

### 4.6 Express Checkout Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| EC-001 | 🔶 | `paymentMethods` 的 never/always 生效；`auto` 为 mock 检测（全部可用），真实设备检测未做 |
| EC-002~004 | ✅ | Apple Pay / Google Pay / PayPal 按钮（mock 授权，无真实钱包 SDK） |
| EC-005 | ✅ | Link 按钮（P2，mock） |
| EC-006 | ✅ | `buttonType`（plain/pay/buy/book/donate）× `buttonTheme`（black/white/white-outline）× `buttonHeight` |
| EC-007 | 🔶 | `layout.maxColumns` 网格布局（1 列即纵向）；未用 horizontal/vertical 字面量 |
| EC-008 | ✅ | ready 事件透出 `availablePaymentMethods` |
| EC-009 | 🔶 | `confirm` ✅；`cancel` 核心已接线但字段层无取消 UI；`loaderror` 未用 |
| EC-010 | ✅ | `complete('success' \| 'fail')` → 按钮 ✓/✕ 闪烁反馈 |

### 4.7 Address Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| AE-001~010 | ✅ | 国家动态字段（state/city/postal）、shipping/billing 模式、电话字段控制、邮编校验、defaultValues 预填（`AddressField.vue`） |

### 4.8 Ideal Bank Element（iDEAL）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| IB-001 | ✅ | 完整 13 家 iDEAL 银行（`bank-data.ts`） |
| IB-002 | ✅ | 搜索过滤（名称 + ID 模糊匹配） |
| IB-003 | ✅ | 银行首字母图标占位（可替换为真实 logo） |
| IB-004 | ✅ | 选中高亮 + change 事件返回 `bank` ID |

### 4.9 Iban Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| IBA-001 | ✅ | IBAN 输入 + 自动格式化（每 4 字符空格，`formatIban`） |
| IBA-002 | ✅ | 国家码自动检测（前 2 字符） |
| IBA-003 | ✅ | MOD-97 校验算法（`mod97Check`，`validateIban`） |
| IBA-004 | ✅ | 75+ 国家长度规则表（`IBAN_COUNTRY_LENGTHS`） |
| IBA-005 | ✅ | `invalid` / `incomplete` 错误消息 |
| IBA-006 | ✅ | 自定义 placeholder（按 `placeholderCountry` 生成示例） |

### 4.10 Au Bank Account Element（BECS）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| AU-001 | ✅ | BSB 输入（6 位，`XXX-XXX` 格式化，`formatBsb`） |
| AU-002 | ✅ | 账号输入（最多 9 位数字） |
| AU-003 | ✅ | 账户名 + 邮箱（选填） |
| AU-004 | ✅ | BSB 长度校验（`validateBsb`） |
| AU-005 | ✅ | change 事件返回完整银行信息 |

### 4.11 Fpx Bank Element（Malaysia FPX）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| FPX-001 | ✅ | 17 家 FPX 银行（`bank-data.ts`） |
| FPX-002 | ✅ | 搜索过滤 + 首字母图标 |
| FPX-003 | ✅ | online/offline 状态区分显示 |

### 4.12 Eps Bank Element（Austria）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| EPS-001 | ✅ | 23 家奥地利 EPS 银行 |
| EPS-002 | ✅ | 银行选择 + 首字母图标 |
| EPS-003 | ✅ | change 事件返回选中银行 |

### 4.13 P24 Bank Element（Poland Przelewy24）

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| P24-001 | ✅ | 28 家 P24 银行 |
| P24-002 | ✅ | 搜索过滤 |
| P24-003 | ✅ | 首字母图标占位 |

### 4.14 Payment Method Messaging Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| PMM-001 | ✅ | BNPL 分期信息展示（Afterpay/Klarna/Affirm/PayPal，按金额计算） |
| PMM-002 | ✅ | 多货币支持（USD/EUR/GBP/AUD） |
| PMM-003 | ✅ | default/compact 双样式 |
| PMM-004 | ✅ | 品牌可选 + Learn More 链接 |

### 4.15 Link Authentication Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| LA-001 | ✅ | 手机号/邮箱 OTP 登录流程 |
| LA-002 | ✅ | 6 位验证码输入（自动聚焦 + 退格导航） |
| LA-003 | ✅ | 30 秒重发倒计时 |
| LA-004 | ✅ | 验证成功状态展示 |
| LA-005 | ✅ | change 事件（complete/valid/empty） |

### 4.17 Cart Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| CART-001 | ✅ | 商品列表展示（名称/描述/单价/数量/小计） |
| CART-002 | ✅ | 费用汇总：小计/运费/税费/优惠/合计 |
| CART-003 | ✅ | 优惠码输入与应用（NEXUS10/SAVE20/FREESHIP） |
| CART-004 | ✅ | 数量编辑（+/−）+ 商品删除（×） |
| CART-005 | ✅ | 空购物车状态展示 |
| CART-006 | ✅ | 配送方式选择（标准/加急/当日达） |

### 4.18 Order Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| ORD-001 | ✅ | 订单状态展示（pending/processing/paid/failed/cancelled/refunded） |
| ORD-002 | ✅ | 商品详情 + 支付方式展示（卡品牌/末四位/有效期） |
| ORD-003 | ✅ | 收货地址展示（姓名/电话/详细地址） |
| ORD-004 | ✅ | 订单时间线（状态节点 + 时间戳 + 描述） |
| ORD-005 | 🔶 | 状态切换通过 update 实现；轮询/WebSocket 预留 |

### 4.15 Afterpay Clearpay Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| APC-001 | ✅ | 4 期免息分期计算（amount / 4） |
| APC-002 | ✅ | US/AU/NZ/CA = Afterpay，UK/EU = Clearpay（按 locale 切换） |
| APC-003 | ✅ | 超限文案提示（各货币独立限额） |
| APC-004 | ✅ | default / compact 双样式 |
| APC-005 | ✅ | 实时金额联动（:key 绑定触发 iframe 重建） |

### 4.19 Wallet Button Element

| 需求ID | 状态 | 实现说明 |
|--------|------|----------|
| WB-001 | ✅ | 4 种钱包：Apple Pay / Google Pay / PayPal / Link |
| WB-002 | ✅ | 主题：black / white / white-outline |
| WB-003 | ✅ | 按钮类型：pay / buy / book / donate / plain |
| WB-004 | ✅ | 自定义高度（36-64px） |
| WB-005 | ✅ | disabled 状态 |

### 5.4 Appearance 主题系统

| 能力 | 状态 | 实现说明 |
|------|------|----------|
| 4 套预设主题 | ✅ | stripe / flat / night / none（`packages/core/src/theme/index.ts`，26 个单测） |
| variables 覆写 | ✅ | 映射为 `--nexus-*` CSS 变量注入 iframe |
| rules 覆写 | ✅ | `.Input`/`.Tab`/`.Block`/`.Radio` 等 10 类选择器映射注入 `<style>` |
| 运行时切换 | ✅ | `elements.update({appearance})` → `nexus:appearance` 热更新（E2E 验证 night 背景 / flat 圆角） |
| Element 级 style 选项 | ✅ | `base/complete/empty/invalid/focus/disabled` 状态样式对象，`useElementStyle` 组合式函数注入动态 `<style>` 标签（Card/CardNumber/CardExpiry/CardCvc/IBAN） |

### 5.6 校验框架 / 5.7 国际化 / 其他

| 能力 | 状态 | 实现说明 |
|------|------|----------|
| cardNumber/cardExpiry/cardCvc 校验器 | ✅ | 55 个单测（Luhn、品牌长度、MM/YY、CVC） |
| 校验器注册表抽象（iban/bsb/postalCode） | ✅ | 统一注册表 `registerValidator(type, fn)` / `validate(type, value, context?)`，预置 cardNumber/cardExpiry/cardCvc/iban/bsb，支持商户自定义（11 单测，`packages/fields/src/validation/registry.ts`） |
| i18n（10 locale） | ✅ | 86 个翻译键（en/zh/ja/ko/de/fr/es/it/pt/nl），覆盖校验消息、标签、Cart/Order/APC/Link 文案（`packages/fields/src/i18n/index.ts`，27 单测） |
| WCAG 2.1 AA | ✅ | aria-label / aria-invalid / aria-checked / role=alert / role=radio / tabindex / focus-visible / 键盘导航 全面审计修复（LinkAuthentication / Cart / WalletButton / ExpressCheckout / CardField / PaymentField / 银行选择器） |
| 单测覆盖率度量与补齐 | ✅ | 169 个单元测试（core 63 + fields 106），覆盖 element 生命周期 / 桥通信 / i18n / 校验器注册表 / useCardInputs 组合式函数 |
| SDK < 50KB gzip | ✅ | core 5.2 KB + fields JS 51 KB + CSS 4.4 KB gzip；SDK 总计 66.3 KB gzip（`scripts/verify-bundle.mjs` 自动校验） |

---

## 三、主要改动点（按模块）

### packages/core（框架无关 SDK）

| 文件 | 改动 |
|------|------|
| `src/iframe/bridge.ts` | HMAC-SHA256 签名/验签（Web Crypto + Key 缓存）；多 iframe 注册表（`Map<elementId, iframe>`）；`attach/detach` 生命周期；`sendAndWait` 请求-响应模式 |
| `src/element.ts` | mount/unmount/destroy/update/focus/blur/clear；`setAppearance` 热更新；**分组收集** `collectGroupedCardData()`（tokenize 前聚合兄弟字段）；**confirm/cancel 事件**接线（含 `complete(status)` 回调） |
| `src/elements.ts` | create 时注入 groupProvider；update 广播 appearance |
| `src/nexus.ts` | `confirmCardPayment`（+return_url、3DS 自动跳转）；`confirmPayment`（elements 路径 + **paymentMethodId 直接路径**）；`confirmSetup`；`initEmbeddedCheckout` 骨架 |
| `src/theme/index.ts` | 4 预设 + variables/rules 解析（`resolveAppearance`） |
| `src/types/bridge.ts` | 桥消息类型全集；`GroupedCardData` / `ExpressConfirmPayload` / `CompletePayload` / `ResolvedAppearancePayload` |
| `src/types/index.ts` | `ConfirmPaymentParams` 增 `paymentMethodId`、elements 改可选；`ChangeEvent` 增 `paymentMethodType`；新增 `CartElementOptions`/`OrderElementOptions`/`AfterpayClearpayElementOptions`/`WalletButtonElementOptions`/`CartItem`/`OrderStatus`/`OrderTimelineEvent` 类型 |
| `src/loader.test.ts` | **新增**：11 个 `loadScript` 单测（jsdom 环境）——去重、重试退避、SRI 属性、失败清理 |

### packages/fields（iframe 内字段层，Vue 实现）

| 文件 | 改动 |
|------|------|
| `src/bridge/index.ts` | FieldBridge：同源 HMAC 验签、init 后动态设密钥 |
| `src/appearance.ts` | CSS 变量 + rules 样式表注入（10 类选择器映射） |
| `src/validation/` | 品牌 BIN 表、格式化器、三字段校验器（55 单测） |
| `src/composables/useCardInputs.ts` | 卡输入状态/校验/粘贴处理复用组合式函数（CardField 与 PaymentField 共用） |
| `src/fields/CardField.vue` | 合并卡字段（号/期/码 + 品牌图标 + 错误提示） |
| `src/fields/Card{Number,Expiry,Cvc}Field.vue` | 拆分三字段；**collect-data 响应 + tokenize 合并 groupedCard** |
| `src/fields/PaymentField.vue` | 聚合组件：三布局 × 方式选择器 × 卡/重定向子表单 × 运行时更新 |
| `src/fields/ExpressCheckoutField.vue` | 钱包按钮：可用性/样式/布局 + confirm → processing → complete 状态机 |
| `src/fields/AddressField.vue` | 地址收集：国家动态字段 + 邮编校验 + shipping/billing 模式 |
| `src/fields/IdealBankField.vue` | iDEAL 银行选择器：13 家银行 + 搜索过滤 + 选中高亮 |
| `src/fields/FpxBankField.vue` | FPX 银行选择器：17 家银行 + online/offline 状态 |
| `src/fields/EpsBankField.vue` | EPS 银行选择器：23 家奥地利银行 |
| `src/fields/P24BankField.vue` | P24 银行选择器：28 家波兰银行 |
| `src/fields/IbanField.vue` | IBAN 输入：自动格式化 + MOD-97 校验 + 国家长度检测 |
| `src/fields/AuBankAccountField.vue` | BECS 账户：BSB + 账号 + 姓名 + 邮箱 |
| `src/fields/PaymentMessagingField.vue` | BNPL 分期信息展示（Afterpay/Klarna/Affirm/PayPal） |
| `src/fields/LinkAuthenticationField.vue` | Link OTP 登录：手机/邮箱 → 验证码 → 验证成功 |
| `src/fields/CartField.vue` | 购物车：商品列表/数量编辑/优惠码/运费/费用汇总 |
| `src/fields/OrderField.vue` | 订单详情：状态/商品/支付方式/地址/时间线 |
| `src/fields/AfterpayClearpayField.vue` | Afterpay/Clearpay BNPL 分期：4 期免息/品牌切换/限额 |
| `src/fields/WalletButtonField.vue` | 单钱包按钮：Apple Pay/Google Pay/PayPal/Link |
| `src/bank-data.ts` | 银行数据：iDEAL 13 / FPX 17 / EPS 23 / P24 28 + IBAN 国家长度表 |
| `src/App.vue` | 字段组件注册表（19 种 type）+ appearance 应用 |

### packages/vue（Vue 3 适配层）

- `NexusElement.vue` 通用包装：create/mount/事件转发（10 种事件）/options 深监听 update/expose getElement
- 19 个具名组件（Card/CardNumber/CardExpiry/CardCvc/Payment/Iban/ExpressCheckout/Address/IdealBank/FpxBank/EpsBank/P24Bank/AuBankAccount/PaymentMessaging/LinkAuthentication/Cart/Order/AfterpayClearpay/WalletButton），经 `$attrs` 透传事件
- `NexusElementsProvider.vue`：nexus + elements 创建、options 热更新、`ready(nexus, elements)` 事件

### examples（示例应用 + mock 后端）

- `plugins/mock-api.ts`：PaymentIntent CRUD、**token 签发（card 完整卡强制 + payment_method_type 重定向/钱包 token）**、confirm（拒付卡/3DS 卡行为矩阵）、3DS 模拟挑战页、encryption_key stub
- 5 个示例页：首页、合并卡（含主题切换）、拆分卡、Payment Element（真实 confirmPayment 流程）、Express Checkout
- vite 别名直指 core/vue 源码（HMR），fields 从 dist 服务（改后需 `pnpm --filter @nexus-elements/fields build`）

### 测试与验证

- 单元测试 169 个：core 63（bridge 签名格式、createNexus、confirmPayment 直接路径、loadScript CDN 加载器 11 个、**element 生命周期 24 个**）+ fields 106（校验/格式化 55 + **校验器注册表 11** + **i18n 27** + **useCardInputs 13**）+ theme 26（计入 core）
- E2E 脚本 14 个（Playwright Python，仓库根目录）：
  - `e2e-card-combined.py` — 填卡 → 支付成功 → night/flat 主题断言
  - `e2e-card-split.py` — 三 iframe 填卡 → 分组聚合 → 支付成功
  - `e2e-3ds.py` — 3DS 卡 → 挑战页 → 批准 → 回跳 → 支付成功
  - `e2e-payment-element.py` — tabs 卡支付 → accordion/radio 切换 → iDEAL 银行选择支付
  - `e2e-payment-advanced.py` — 保存支付方式 + billingDetails 收集
  - `e2e-express-checkout.py` — 钱包可用性透出 → Apple Pay 确认 → complete('success') → 样式/布局断言
  - `e2e-embedded-checkout.py` — 托管页 iframe → 拒绝卡 → 成功支付 → onComplete postMessage
  - `e2e-setup.py` — confirmSetup → setup_intent 成功 + 拒绝路径
  - `e2e-address.py` — 地址动态字段 + 邮编校验 + billing 模式切换
  - `e2e-bank-transfer.py` — iDEAL/IBAN/BECS/FPX/EPS/P24 六组件 tab 切换 + 选择/输入 + change 事件
  - `e2e-redirect-checkout.py` — 订单页 → 跳转托管 → 支付 → 回跳成功页
  - `e2e-billing.py` — 套餐选择（月/年切换）→ Payment Element → SetupIntent 订阅成功
  - `e2e-payment-messaging.py` — BNPL 分期展示 + 金额联动 + 货币切换 + compact 样式
  - `e2e-link-authentication.py` — 手机号/邮箱 OTP 登录 → 验证码输入 → 验证成功
  - `e2e-cart.py` — 购物车商品列表/数量编辑/优惠码/配送选择/空状态
  - `e2e-order.py` — 订单状态切换/商品详情/支付方式/地址/时间线
  - `e2e-afterpay-clearpay.py` — BNPL 4 期免息/品牌切换/compact 样式/限额处理
  - `e2e-wallet-button.py` — 钱包切换/主题/类型/高度/禁用状态

---

## 四、已知缺口与后续计划

**Phase 3 已完成。** 所有银行组件、Redirect Checkout、E2E 测试均已实现。

**Phase 4 已完成。** 全部 19 组件、CDN 加载器、i18n（10 locale）、Storybook、Element 级样式、校验器注册表、WCAG 2.1 AA 审计、单测补齐（169 个）均已实现。

**部署项（非本仓库职责，文档记录）：** SEC-005 独立域、SEC-006 CSP、SEC-007 X-Frame-Options、TOK-002 应用层加密。
