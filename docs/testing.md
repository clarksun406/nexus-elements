# 测试金字塔

数量从下往上减少：单元最多，然后是同一套契约在两个实现上各跑一遍，再是少量 Postgres 集成，E2E 只留关键支付路径。

当前计数（vitest `it` / Playwright `test`）：

| 层 | 用例数 | 内容 |
|----|--------|------|
| 单元 | **132** | contracts 校验 4。server 128：状态机非法迁移、沙箱网关、脱敏、webhook 签名、解密失败、鉴权与配置解析、幂等冲突、每个 `/v1` 家族的校验与错误信封、token 过期/复用 |
| 契约 | **12** 个场景 × 2 个实现 = 24 次执行 | `packages/contracts/suite/run.ts`，mock-api 与 `apps/server` 各跑一遍 |
| 集成 | **9** | 真实 Postgres：重启后仍能读到支付与加密密钥、token 过期、迁移重放；以及 payment_intents、setup_intents、checkout、3DS、orders、payment_methods、CORS/限流 |
| E2E（server） | **6** | 合并卡、拆分卡、3DS、SetupIntent、嵌入式结账、跳转结账 |
| E2E（mock） | **17** | 原有示例站点全量，仍打 mock-api |

132 个单元 > 24 次契约执行 > 9 个集成 > 6 个服务端 E2E。

| 层 | 命令 |
|----|------|
| 单元 + 契约 + 集成 | `pnpm --filter @nexus-elements/contracts test` 与 `pnpm --filter @nexus-elements/server test`。没有 `DATABASE_URL` 时 9 个集成用例跳过 |
| 覆盖率 | `pnpm --filter @nexus-elements/server test:coverage`。`apps/server/src` 行 / 语句 / 函数 ≥ 90%，分支 ≥ 85%（不含 `src/index.ts` 和纯类型文件）。必须有 `DATABASE_URL`，否则 Postgres 仓储不会计入、阈值失败 |
| E2E mock | `pnpm e2e` |
| E2E server | `pnpm e2e:server`（内存后端，不依赖数据库） |

最近一次本地覆盖率：行 99.0%，函数 99.3%，分支 89.1%。CI 用 GitHub Actions 的 Postgres service 注入 `DATABASE_URL`。

本地 Postgres：

```bash
docker compose up postgres -d
export DATABASE_URL=postgres://nexus:nexus@127.0.0.1:5432/nexus
pnpm --filter @nexus-elements/server test:coverage
```

内存后端：

```bash
pnpm --filter @nexus-elements/server build
STORE=memory PORT=3001 node apps/server/dist/index.js
pnpm e2e:server
```
