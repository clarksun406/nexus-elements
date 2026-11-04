# 安全部署（SEC-005 / SEC-006 / SEC-007 / TOK-002）

## 父页面与 iframe 通道

- 每个 `NexusElements` 实例生成随机信道密钥与分组密钥。密钥**不是** publishable key，也不会被后续 `nexus:init` 替换。
- 密钥放在 iframe URL 的 hash（`#nexus=`）里，不会随请求发到服务器。字段页读完后立刻 `replaceState` 去掉 hash。
- 父页面只向字段源站 `postMessage`（显式 `targetOrigin`）。字段页只向创建它的父源站回传。
- 两侧都校验 `event.origin` 与 `event.source`（必须是对应的 iframe / `window.parent`）。
- 签名覆盖 `id`、`type`、`elementId`、`payload` 和 `timestamp`。超过 60 秒的消息、重复 `id`、以及非常量时间比较失败的签名都会被丢弃。
- 父页面在分发前还会删掉 `number` / `cvc` / `pan` / `iban` / `account_number` 等字段，避免字段实现回归时把原始数据交给商户脚本。

## 拆分卡字段

卡号、有效期、CVC 不经过父页面。同一 `NexusElements` 下的字段 iframe 用分组密钥做 AES-GCM，在字段源站的 `BroadcastChannel` 上交换分段，再由收到 `nexus:tokenize` 的那个 iframe 调用 `/v1/tokens`。父页面只收到 `tok_` / `pm_`。

## 应用层加密（TOK-002）

字段层在 tokenize 前请求 `GET /v1/encryption_key`。当响应为 `RSA-OAEP` 且带有 JWK 时，卡对象用 AES-256-GCM 加密，AES 密钥用服务端公钥做 RSA-OAEP（SHA-256）封装，请求体只有 `encrypted_card`。Mock API 会解密后再做校验。密钥接口不可用时退回仅 TLS，以免演示环境无法支付。

托管 Checkout 页本身就在 API 源站上收集卡数据，不经过商户页面，因此继续以 TLS 直传。

## iframe sandbox

元素 iframe 与嵌入式 Checkout 使用：

```
allow-scripts allow-same-origin allow-forms
```

没有 `allow-top-navigation`、`allow-popups`。`allow-same-origin` 保留，是因为同组字段要使用 BroadcastChannel，并且字段页要向 API 发 `fetch`。Checkout 需要跳转时改为 `postMessage` 通知父页面，由父页面导航。

## 独立字段源站（SEC-005）

生产环境把字段构建产物部署到独立源站（例如 `https://fields.nexuspay.com`），创建实例时传入：

```ts
createNexus('pk_live_xxx', {
  apiBase: 'https://api.nexuspay.com',
  fieldsUrl: 'https://fields.nexuspay.com/index.html',
})
```

开发模式使用同源的 `/fields/index.html`（示例站点会托管 `packages/fields/dist`）。

**不使用 srcdoc。** `srcdoc` 加上 `allow-same-origin` 会与商户页面同源，商户脚本可以读 DOM；不加 `allow-same-origin` 则变成不透明源，无法与兄弟字段共享 BroadcastChannel，也无法按配置的 API 源站取 token。独立源站才是 PRD 要的隔离。

## CSP 与点击劫持（SEC-006 / SEC-007）

Mock API 与示例站点的字段静态服务器会下发这些头：

| 响应 | `X-Frame-Options` | `Content-Security-Policy` |
| --- | --- | --- |
| `/v1/*` 等 API | `DENY` | `frame-ancestors 'none'` |
| 字段 HTML、托管 Checkout | 仅当祖先为 `'self'` 时 `SAMEORIGIN` | `frame-ancestors` 来自 `NEXUS_FRAME_ANCESTORS` |

`X-Frame-Options` 不能表达“允许这些商户域嵌入”。字段页必须能被商户页面嵌入，所以生产环境用 CSP `frame-ancestors` 做白名单，而不是对字段域发送 `DENY`（那会让 Elements 无法加载）。API 响应则同时使用 `DENY` 和 `frame-ancestors 'none'`。

```bash
NEXUS_FRAME_ANCESTORS="'self' https://merchant.example"
NEXUS_CONNECT_SRC="'self' https://api.nexuspay.com"
```

字段页的 `connect-src` 必须包含 API 源站，否则 iframe 里的 tokenize 请求会被 CSP 拦截。

## 商户后端的 PCI 边界（apps/server）

卡号只在 `POST /v1/tokens` 的请求处理栈里出现：解密（若客户端做了 TOK-002）、Luhn / 品牌识别、测试卡结果分类、HMAC 指纹。落库的是 `last4`、品牌、有效期、分类结果和指纹，不是 PAN，也不是 CVC。日志序列化会把 `number` / `cvc` / `pan` / `encrypted_card` 打成 `[redacted]`。

RSA 私钥优先读 `NEXUS_RSA_PRIVATE_KEY`（生产应来自 KMS / HSM）。未配置时，进程内生成一把沙箱密钥；Postgres 模式下会写入 `encryption_keys`，只为了重启后仍能解开在途密文。这不是生产密钥存储方案。

`apps/server` 对 `/v1/*` 要求 `X-Nexus-Key` 或 `Authorization: Bearer sk_`。`X-Nexus-Account` 若出现，必须等于 `NEXUS_ACCOUNT_ID`。mock-api 不校验这两个头，契约测试统一带上示例公钥。
