# 测试金字塔

数量从下往上减少：单元最多，然后是同一套契约在两个实现上各跑一遍，再是少量 Postgres 集成，E2E 只留关键支付路径。

相对 baseline（`61d9942`）Batch 1 增量：3DS handoff 单测、Link 嵌入单测、契约 `subscription_mode` 场景、Postgres 3DS `cancelled`、E2E 3DS 取消 / Link 行 / Billing 文案。

| 层 | 用例数（Batch 1 后，本地计数） | 内容 |
|----|--------------------------------|------|
| 单元 | **~368**（vitest `it`） | core + fields + server（内存）+ contracts 校验 + mock-api + vue；含 `three-ds-handoff.test.ts`、`payment-link-embed.test.ts`、checkout 订阅拒绝 |
| 契约 | **13** 场景 × 2 实现 = **26** 次执行 | `packages/contracts/suite/run.ts` |
| 集成 | **9**（Postgres，需 `DATABASE_URL`） | 含 3DS `cancelled` 状态迁移 |
| E2E mock | **20** | 原 17 + 3DS 取消、Link 行、Billing 文案 |
| E2E server | **6** × 2 配置（memory / Postgres） | `playwright.server.config.ts` |

| 层 | 命令 |
|----|------|
| 全量单测 | `pnpm test`（Postgres 集成需 `DATABASE_URL`，否则 9 例跳过） |
| Lint + 类型 | `pnpm lint` · `pnpm typecheck` |
| 契约 | `pnpm --filter @nexus-elements/contracts test` |
| 覆盖率 | `DATABASE_URL=postgres://nexus:nexus@127.0.0.1:5432/nexus pnpm test:coverage` |
| E2E mock | `pnpm e2e` |
| E2E server | `pnpm e2e:server` |

CI（`.github/workflows/ci.yml`）在 PR 上运行：install → contracts build → typecheck → **lint** → tests → coverage → mock + vue tests → bundle verify → `pnpm e2e` → `pnpm e2e:server`，并注入 Postgres `DATABASE_URL`（集成与覆盖率零跳过）。

本地 Postgres：

```bash
docker compose up postgres -d
export DATABASE_URL=postgres://nexus:nexus@127.0.0.1:5432/nexus
pnpm --filter @nexus-elements/server test:coverage
```

内存后端 E2E：

```bash
pnpm --filter @nexus-elements/server build
STORE=memory PORT=3001 node apps/server/dist/index.js
pnpm e2e:server
```