# Nexus Elements 后端接口文档

> SDK 前端依赖的后端 API 契约。商户后端需实现以下接口，SDK 才能完成完整支付闭环。
> 基础路径：`/v1`，所有请求/响应均为 JSON。

---

## 1. 概述

### 1.1 架构角色

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  商户前端     │     │  Fields Iframe   │     │  商户后端         │
│  (nexus-js)  │────→│  (nexus-fields)  │────→│  (实现本文档 API) │
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                                             │
       └──────────── confirm 请求 ──────────────────→│
```

- **Fields Iframe** 调用 `POST /v1/tokens` 将敏感数据换取 token
- **商户前端 SDK** 调用 `POST /v1/payment_intents/confirm` 等接口完成支付确认
- 商户后端负责与支付网关/通道对接，本文档定义的是 **SDK ↔ 商户后端** 之间的契约

### 1.2 鉴权

| Header | 说明 | 适用接口 |
|--------|------|----------|
| `X-Nexus-Key` | 商户公开密钥 `pk_test_xxx` / `pk_live_xxx` | 所有前端发起的请求 |
| `X-Nexus-Client-Secret` | Intent 的 client_secret，证明请求关联合法 Intent | confirm 类接口 |
| `Content-Type` | `application/json` | 所有 POST 请求 |

### 1.3 通用错误格式

所有错误响应使用统一结构（对齐 Stripe 错误格式）：

```json
{
  "error": {
    "type": "card_error | api_error | validation_error | network_error",
    "code": "card_declined | insufficient_funds | expired_card | incorrect_cvc | processing_error | invalid_amount",
    "message": "人类可读的错误描述",
    "decline_code": "insufficient_funds",
    "payment_intent": { }
  }
}
```

HTTP 状态码约定：

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数校验失败 |
| 401 | 密钥无效 |
| 402 | 支付被拒（card_declined） |
| 404 | 资源不存在 |
| 409 | 状态冲突（如 Intent 已确认） |
| 429 | 限流 |
| 500 | 服务端错误 |

---

## 2. Token 接口

### 2.1 创建 Token（敏感数据换取）

**调用方**: Fields Iframe（隔离环境内，卡号原文仅在此处传输）

```
POST /v1/tokens
```

#### 请求

```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2028,
    "cvc": "123"
  },
  "billing_details": {
    "name": "张三",
    "email": "zhang@example.com",
    "phone": "+8613800138000",
    "address": {
      "line1": "朝阳区 xx 路 1 号",
      "city": "北京",
      "state": "北京",
      "postal_code": "100000",
      "country": "CN"
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| client_secret | string | 是 | 关联的 Intent client_secret，用于绑定商户身份 |
| card.number | string | 是 | 卡号纯数字（13-19位） |
| card.exp_month | number | 是 | 过期月 1-12 |
| card.exp_year | number | 是 | 过期年（4位，如 2028） |
| card.cvc | string | 是 | 安全码 3-4 位 |
| billing_details | object | 否 | 账单信息 |

#### 响应 200

```json
{
  "token": "tok_1a2b3c4d5e",
  "payment_method_id": "pm_1a2b3c4d5e",
  "type": "card",
  "card": {
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2028,
    "funding": "credit",
    "country": "US"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| token | string | 一次性 token，`tok_` 前缀，5 分钟过期，单次使用 |
| payment_method_id | string | 持久化 PaymentMethod ID，`pm_` 前缀 |
| card | object | 脱敏卡信息（仅 last4，绝不返回完整卡号） |

#### 安全要求

- **MUST**: 此接口必须通过 HTTPS 提供
- **MUST**: token 单次有效，使用后立即失效
- **MUST**: token 5 分钟过期
- **MUST**: 响应中不得包含完整卡号
- **SHOULD**: 对 card.number 做 Luhn 预校验，无效直接返回 400
- **SHOULD**: 限流（建议 10 req/min/IP）防暴力枚举

#### 错误示例

```json
{
  "error": {
    "type": "validation_error",
    "code": "invalid_number",
    "message": "卡号无效，请检查后重试。"
  }
}
```

---

## 3. PaymentIntent 接口

### 3.1 创建 PaymentIntent

**调用方**: 商户前端（或商户后端自行创建后下发 client_secret）

```
POST /v1/payment_intents
```

#### 请求

```json
{
  "amount": 9900,
  "currency": "cny",
  "description": "订单 #20260727001",
  "metadata": {
    "order_id": "20260727001"
  },
  "payment_method_types": ["card"],
  "receipt_email": "zhang@example.com",
  "capture_method": "automatic",
  "confirm_mode": "manual"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| amount | number | 是 | 金额，最小单位整数（分），> 0 |
| currency | string | 是 | ISO 4217 小写（cny/usd/eur...） |
| description | string | 否 | 描述 |
| metadata | object | 否 | 自定义键值对（≤50 key，key/value ≤500 字符） |
| payment_method_types | string[] | 否 | 允许的支付方式，默认 `["card"]` |
| receipt_email | string | 否 | 收据邮箱 |
| capture_method | string | 否 | `automatic`（默认）/ `manual` |

#### 响应 200

```json
{
  "payment_intent": {
    "id": "pi_1a2b3c4d5e",
    "object": "payment_intent",
    "amount": 9900,
    "currency": "cny",
    "status": "requires_payment_method",
    "client_secret": "pi_1a2b3c4d5e_secret_6f7g8h",
    "description": "订单 #20260727001",
    "metadata": { "order_id": "20260727001" },
    "payment_method_types": ["card"],
    "created": 1753603200
  }
}
```

#### PaymentIntent 状态机

```
requires_payment_method ──confirm──→ processing ──→ succeeded
        │                                │
        │                                ├──→ requires_action ──(3DS完成)──→ processing
        │                                │
        └────────── cancel ──────────────┴──→ canceled
```

| 状态 | 含义 |
|------|------|
| `requires_payment_method` | 等待支付方式（初始状态） |
| `processing` | 处理中 |
| `requires_action` | 需要额外验证（3DS 挑战） |
| `succeeded` | 支付成功 |
| `canceled` | 已取消 |

---

### 3.2 确认支付

**调用方**: 商户前端 SDK（`nexus.confirmCardPayment` / `nexus.confirmPayment`）

```
POST /v1/payment_intents/confirm
```

#### Headers

```
X-Nexus-Key: pk_test_xxx
X-Nexus-Client-Secret: pi_xxx_secret_xxx
```

#### 请求

```json
{
  "payment_method_token": "tok_1a2b3c4d5e",
  "return_url": "https://merchant.com/payment/result",
  "receipt_email": "zhang@example.com"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| payment_method_token | string | 是 | Token 接口返回的 `token` 或 `payment_method_id` |
| return_url | string | 否 | 3DS/重定向完成后的回跳地址 |
| receipt_email | string | 否 | 覆盖 Intent 上的收据邮箱 |

#### 响应 200 — 直接成功

```json
{
  "payment_intent": {
    "id": "pi_1a2b3c4d5e",
    "object": "payment_intent",
    "amount": 9900,
    "currency": "cny",
    "status": "succeeded",
    "client_secret": "pi_1a2b3c4d5e_secret_6f7g8h",
    "payment_method": "pm_1a2b3c4d5e"
  }
}
```

#### 响应 200 — 需要 3DS 验证

```json
{
  "payment_intent": {
    "id": "pi_1a2b3c4d5e",
    "object": "payment_intent",
    "status": "requires_action",
    "client_secret": "pi_1a2b3c4d5e_secret_6f7g8h"
  },
  "next_action": {
    "type": "redirect",
    "redirect_url": "https://3ds.nexuspay.com/challenge/pi_1a2b3c4d5e?return_url=..."
  }
}
```

SDK 行为：收到 `requires_action` + `next_action.redirect_url` 时，若 `redirect !== 'if_required'` 则自动跳转。

#### 错误响应 402 — 卡被拒绝

```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "decline_code": "insufficient_funds",
    "message": "您的卡余额不足，请更换支付方式。",
    "payment_intent": {
      "id": "pi_1a2b3c4d5e",
      "status": "requires_payment_method"
    }
  }
}
```

#### 校验规则

- **MUST**: 验证 `X-Nexus-Client-Secret` 与 Intent 匹配
- **MUST**: 验证 token 有效性（未过期、未使用、绑定同一商户）
- **MUST**: Intent 状态为 `requires_payment_method` 或 `requires_action` 时才允许 confirm
- **MUST**: confirm 成功后 token 立即作废
- **SHOULD**: 支持幂等（相同 token 重复 confirm 返回相同结果而非重复扣款）

---

### 3.3 更新 PaymentIntent

**调用方**: 商户前端（Payment Element Update 模式）

```
POST /v1/payment_intents/:id
```

#### 请求（仅白名单字段可更新）

```json
{
  "amount": 19900,
  "currency": "cny",
  "description": "更新后的描述",
  "metadata": { "order_id": "20260727002" },
  "receipt_email": "new@example.com",
  "payment_method_types": ["card", "alipay"]
}
```

| 可更新字段 | 约束 |
|-----------|------|
| amount | 仅 `requires_payment_method` 状态下可改 |
| currency | 同上 |
| description | 任意状态 |
| metadata | 任意状态 |
| receipt_email | 任意状态 |
| payment_method_types | 仅 `requires_payment_method` 状态下可改 |

#### 响应 200

返回更新后的完整 `payment_intent` 对象。

#### 错误

- 409: Intent 状态不允许更新（如已 succeeded）
- 400: 非白名单字段 → 忽略或报错（建议报错明确提示）

---

### 3.4 取消 PaymentIntent

```
POST /v1/payment_intents/:id/cancel
```

#### 响应 200

```json
{
  "payment_intent": {
    "id": "pi_1a2b3c4d5e",
    "status": "canceled"
  }
}
```

仅 `requires_payment_method` / `requires_action` 状态可取消。

---

## 4. SetupIntent 接口（保存卡片）

### 4.1 创建 SetupIntent

```
POST /v1/setup_intents
```

#### 请求

```json
{
  "usage": "off_session",
  "customer_email": "zhang@example.com",
  "metadata": {}
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| usage | string | 否 | `off_session`（默认，后续免密扣款）/ `on_session` |
| customer_email | string | 否 | 提供则自动创建/关联 Customer |

#### 响应 200

```json
{
  "setup_intent": {
    "id": "seti_1a2b3c4d5e",
    "object": "setup_intent",
    "status": "requires_payment_method",
    "client_secret": "seti_1a2b3c4d5e_secret_9i0j1k",
    "usage": "off_session"
  }
}
```

### 4.2 确认 SetupIntent

```
POST /v1/setup_intents/confirm
```

#### Headers

```
X-Nexus-Key: pk_test_xxx
X-Nexus-Client-Secret: seti_xxx_secret_xxx
```

#### 请求

```json
{
  "payment_method_token": "tok_1a2b3c4d5e",
  "return_url": "https://merchant.com/cards/saved"
}
```

#### 响应 200

```json
{
  "setup_intent": {
    "id": "seti_1a2b3c4d5e",
    "object": "setup_intent",
    "status": "succeeded",
    "payment_method": "pm_1a2b3c4d5e"
  },
  "payment_method": {
    "id": "pm_1a2b3c4d5e",
    "type": "card",
    "card": {
      "brand": "visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2028
    }
  }
}
```

---

## 5. Checkout Session 接口

### 5.1 创建 Checkout Session

```
POST /v1/checkout/sessions
```

#### 请求

```json
{
  "mode": "payment",
  "ui_mode": "embedded",
  "amount": 9900,
  "currency": "cny",
  "description": "订单 #001",
  "line_items": [
    { "name": "商品A", "quantity": 2, "unit_amount": 4950 }
  ],
  "success_url": "https://merchant.com/success?session_id={SESSION_ID}",
  "cancel_url": "https://merchant.com/cancel"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | string | 是 | `payment` / `subscription` |
| ui_mode | string | 是 | `embedded`（页内嵌入）/ `redirect`（跳转） |
| line_items | array | 否 | 商品明细（embedded 完整模式） |
| success_url | string | 是 | 成功回跳，支持 `{SESSION_ID}` 占位符 |
| cancel_url | string | 是 | 取消回跳 |

#### 响应 200

```json
{
  "checkout_session": {
    "id": "cs_1a2b3c4d5e",
    "object": "checkout.session",
    "status": "open",
    "ui_mode": "embedded",
    "client_secret": "cs_1a2b3c4d5e_secret_2l3m4n",
    "url": "https://checkout.nexuspay.com/cs_1a2b3c4d5e"
  }
}
```

- `ui_mode: embedded` → SDK 用 `client_secret` 初始化嵌入式结账
- `ui_mode: redirect` → 商户前端跳转 `url`

---

## 6. 公钥下发接口（Token 加密用）

### 6.1 获取加密公钥

**调用方**: Fields Iframe（tokenize 前获取，用于应用层加密）

```
GET /v1/encryption_key
```

#### Headers

```
X-Nexus-Key: pk_test_xxx
```

#### 响应 200

```json
{
  "key_id": "ek_2026_07",
  "algorithm": "RSA-OAEP-256",
  "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqh...\n-----END PUBLIC KEY-----",
  "expires_at": 1756281600
}
```

| 字段 | 说明 |
|------|------|
| key_id | 密钥版本标识，token 请求中携带，服务端据此选择解密密钥 |
| algorithm | 加密算法标识 |
| public_key_pem | RSA 公钥 PEM（建议 2048+ 位） |
| expires_at | 公钥过期时间戳，过期后 iframe 重新获取 |

#### 加密流程

```
Fields Iframe:
1. GET /v1/encryption_key → 获取公钥（缓存至 expires_at）
2. 生成随机 AES-256-GCM 会话密钥
3. 用 AES 会话密钥加密卡数据 → ciphertext + iv + tag
4. 用 RSA 公钥加密 AES 会话密钥 → encrypted_key
5. POST /v1/tokens 时携带: { key_id, encrypted_key, iv, ciphertext, tag }
```

> **Phase 1 简化方案**: 可先仅依赖 TLS 传输加密（HTTPS），跳过应用层加密。接口预留，后续启用。

---

## 7. Webhook 通知（服务端 → 服务端）

### 7.1 事件通知

商户后端处理完支付后，应通过 Webhook 通知商户业务系统：

```
POST {merchant_webhook_url}
```

#### 请求

```json
{
  "id": "evt_1a2b3c4d5e",
  "object": "event",
  "type": "payment_intent.succeeded",
  "created": 1753603200,
  "data": {
    "object": {
      "id": "pi_1a2b3c4d5e",
      "object": "payment_intent",
      "amount": 9900,
      "currency": "cny",
      "status": "succeeded",
      "metadata": { "order_id": "20260727001" }
    }
  }
}
```

#### 事件类型

| 事件 | 触发时机 |
|------|----------|
| `payment_intent.succeeded` | 支付成功 |
| `payment_intent.payment_failed` | 支付失败 |
| `payment_intent.canceled` | 支付取消 |
| `payment_intent.requires_action` | 需要 3DS 验证 |
| `setup_intent.succeeded` | 卡片保存成功 |
| `checkout.session.completed` | 结账完成 |

#### 签名验证

```
Header: X-Nexus-Signature: t=1753603200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

签名算法：`HMAC-SHA256(webhook_secret, "{timestamp}.{raw_body}")`

- **MUST**: 商户验证签名后才处理事件
- **MUST**: 时间戳偏差 > 5 分钟拒绝（防重放）
- **SHOULD**: 事件幂等处理（按 `evt.id` 去重）

---

## 8. 测试模式规范

### 8.1 测试卡号

| 卡号 | 品牌 | 行为 |
|------|------|------|
| 4242 4242 4242 4242 | Visa | 支付成功 |
| 4000 0000 0000 9995 | Visa | 余额不足 (insufficient_funds) |
| 4000 0000 0000 0002 | Visa | 卡被拒绝 (card_declined) |
| 4000 0000 0000 3220 | Visa | 触发 3DS 验证 (requires_action) |
| 4000 0000 0000 0069 | Visa | 卡已过期 (expired_card) |
| 4000 0000 0000 0127 | Visa | CVC 错误 (incorrect_cvc) |
| 5555 5555 5555 4444 | Mastercard | 支付成功 |
| 3782 822463 10005 | Amex | 支付成功 |
| 6200 0000 0000 0005 | UnionPay | 支付成功 |

### 8.2 测试模式行为

- `pk_test_` / `sk_test_` 密钥下所有交易为模拟，不产生真实资金流动
- 测试 token 格式 `tok_test_xxx`，与生产 token 隔离
- 任意未来有效期 + 任意 CVC 均视为格式有效
- 特殊卡号触发确定性结果（上表），用于 E2E 测试

---

## 9. 接口优先级与排期建议

| 优先级 | 接口 | Phase |
|--------|------|-------|
| P0 | `POST /v1/tokens` | Phase 1 |
| P0 | `POST /v1/payment_intents` | Phase 1 |
| P0 | `POST /v1/payment_intents/confirm` | Phase 1 |
| P0 | `POST /v1/payment_intents/:id`（更新） | Phase 1 |
| P1 | `GET /v1/encryption_key` | Phase 1（可延后，先走纯 TLS） |
| P1 | `POST /v1/setup_intents` + confirm | Phase 2 |
| P1 | `POST /v1/checkout/sessions` | Phase 2 |
| P1 | `POST /v1/payment_intents/:id/cancel` | Phase 2 |
| P1 | Webhook 通知 | Phase 2 |
| P2 | Subscription 相关 | Phase 3 |

---

## 10. SDK 调用时序（完整支付流程）

```
商户前端                    Fields Iframe              商户后端
   │                            │                         │
   │  1. elements.create('card')│                         │
   │  2. element.mount()        │                         │
   │ ──── iframe 加载 ────────→ │                         │
   │                            │  3. GET /v1/encryption_key (可选)
   │                            │ ──────────────────────→ │
   │                            │ ←────────────────────── │
   │  ←── nexus:ready ────────  │                         │
   │                            │                         │
   │  [用户输入卡号，change 事件流]                          │
   │                            │                         │
   │  4. nexus.confirmCardPayment(clientSecret, {card})   │
   │ ──── nexus:tokenize ─────→ │                         │
   │                            │  5. POST /v1/tokens     │
   │                            │ ──────────────────────→ │
   │                            │ ←── { token: tok_xx } ─ │
   │  ←── nexus:token-result ── │                         │
   │                            │                         │
   │  6. POST /v1/payment_intents/confirm                 │
   │     { payment_method_token: tok_xx }                 │
   │ ──────────────────────────────────────────────────→  │
   │ ←── { payment_intent: { status: succeeded } } ─────  │
   │                            │                         │
   │  [展示支付结果]                                       │
```
