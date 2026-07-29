# Nexus Elements

仿 Stripe Elements 的支付 UI 组件库。敏感支付字段渲染在 sandboxed iframe 中（PCI-DSS 隔离），通过 HMAC-SHA256 签名的 postMessage 桥与商户页面通信，商户代码只接触一次性 token，永不接触原始卡数据。

核心 SDK 框架无关（原生 TypeScript），Vue 3 适配层为一等公民。API 命名与 Stripe Elements 对齐，最小化迁移成本。

> 当前状态：19/19 组件全部实现，Phase 4 收尾中（Storybook / CDN 加载器 + SRI / Element 级样式 / i18n 均已完成）。详见 [实现状态](docs/implementation-status.md)。

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9

### 启动示例应用

```bash
pnpm install
pnpm dev        # 构建 fields 包 + 启动示例站点（含 mock 后端）
```

打开 http://localhost:3000，包含 16 个可交互示例页（合并卡、拆分卡、Payment Element、Express Checkout、Address、银行转账、购物车、订单、Afterpay/Clearpay、钱包按钮等），内置 mock 支付后端与 3DS 模拟挑战页。

测试卡号：`4242 4242 4242 4242`（成功）· `4000 0000 0000 0002`（拒绝）· `4000 0000 0000 3220`（3DS）。更多见 [后端接口文档 §8](docs/backend-api.md)。

### 最小接入示例（Vue）

```vue
<script setup lang="ts">
import { createNexus } from '@nexus-elements/core'
import { NexusElements, NexusCardElement } from '@nexus-elements/vue'

const nexus = createNexus('pk_test_xxx')

async function pay(clientSecret: string, cardElement: NexusElement) {
  const { error, paymentIntent } = await nexus.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement },
    return_url: location.href,          // 3DS 完成后回跳
  })
}
</script>

<template>
  <NexusElements publishable-key="pk_test_xxx" fields-url="/fields/index.html">
    <NexusCardElement :options="{ showIcon: true }" @change="onChange" />
  </NexusElements>
</template>
```

框架无关用法与完整流程见 [集成指南](docs/integration-guide.md)，全部方法/事件/类型见 [API 参考](docs/api-reference.md)。

## 仓库结构

```
packages/
  core/      @nexus-elements/core    框架无关 SDK：Nexus 入口、Elements 工厂、iframe 桥、主题引擎
  fields/    @nexus-elements/fields  iframe 内字段层（Vue 实现，独立构建、独立部署）
  vue/       @nexus-elements/vue     Vue 3 适配层：Provider + 具名组件 + composables
examples/    示例站点 + mock 支付后端（Vite 插件实现 /v1/* API 与 3DS 挑战页）
docs/        需求 PRD、后端 API 契约、实现状态、API 参考、集成指南
e2e-*.py     Playwright E2E 脚本（仓库根目录）
```

## 架构一览

```
商户页面 (core SDK)                iframe (fields)
┌─────────────────────┐   HMAC 签名   ┌──────────────────┐
│ nexus.elements()    │  postMessage  │ CardField.vue 等  │
│ element.mount(el) ──┼──────────────→│ 输入/校验/格式化   │
│ confirmPayment()    │←──────────────┼─ change/ready 事件 │
└─────────┬───────────┘               └────────┬─────────┘
          │ POST /v1/payment_intents/confirm   │ POST /v1/tokens
          ▼          （token，非卡数据）        ▼ （敏感数据 → token）
                    商户后端 / mock API
```

- 卡号等敏感数据只存在于 iframe 内，tokenize 后以 `tok_test_*` / `pm_test_*` 返回
- 拆分字段（cardNumber/cardExpiry/cardCvc）在同一 `elements` 实例下自动成组，tokenize 时聚合
- 主题经 CSS 变量（`--nexus-*`）+ rules 选择器注入 iframe，支持运行时热切换

## 常用命令

```bash
pnpm dev                # 示例站点开发（fields 改动后需重跑，或单独构建 fields）
pnpm build              # 全部包构建
pnpm test               # 全部单元测试（vitest，94 个）
pnpm typecheck          # 全部包 TypeScript 检查
pnpm storybook          # Storybook 组件文档（9 个分类，60+ 变体）
pnpm build-storybook    # 构建 Storybook 静态站点
pnpm verify:bundle      # 构建 + 包体积校验 + SRI 哈希生成
pnpm --filter @nexus-elements/fields build   # 单独构建 fields（examples 从 dist 加载）

python e2e-card-combined.py   # E2E（需先启动 pnpm dev，Playwright Python）
```

注意：examples 通过 Vite 别名直接引用 core/vue 源码（HMR 生效），但 fields 从 `dist` 加载 —— 修改 `packages/fields` 后必须重新构建才能在示例中生效。

## 文档

| 文档 | 内容 |
|------|------|
| [docs/api-reference.md](docs/api-reference.md) | SDK 全部方法、事件、类型 |
| [docs/integration-guide.md](docs/integration-guide.md) | 四种支付流程接入 + 3DS + CDN 加载 + Vue/原生用法 |
| [docs/backend-api.md](docs/backend-api.md) | 商户后端需实现的 API 契约 |
| [docs/requirements.md](docs/requirements.md) | 需求 PRD（19 组件全集） |
| [docs/implementation-status.md](docs/implementation-status.md) | 实现进度与已知缺口 |
| [docs/roadmap.md](docs/roadmap.md) | 项目路线图与功能演进 |
| Storybook（`pnpm storybook`） | 组件交互文档（9 个分类，60+ 变体） |
