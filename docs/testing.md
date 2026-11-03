# 测试金字塔

数量从下往上减少：单元最多，集成次之，契约对 mock 和真实服务各跑一遍，E2E 只覆盖关键支付路径。

| 层 | 跑什么 | 命令 |
|----|--------|------|
| 单元 | contracts 校验；server 的状态机、沙箱网关、加解密、鉴权、幂等、内存仓储 | `pnpm --filter @nexus-elements/contracts test` · `pnpm --filter @nexus-elements/server test` |
| 集成 | 真实 Postgres 上的 HTTP：支付成功后换进程仍能读到、过期 token、幂等、加密密钥重启、库里没有 PAN | 设置 `DATABASE_URL` 后同一条 server test。未设置则跳过 |
| 契约 | `packages/contracts/suite/run.ts`，对 mock-api 和 `apps/server` 各执行一次（tokenize、确认、拒付、3DS、Setup、Checkout、加密卡、订单） | 包含在上面两个包的 `test` 里 |
| E2E | 现有示例站 + mock（全部 spec） | `pnpm e2e` |
| E2E | 同一批关键流程打真实后端：合并卡、拆分卡、3DS、SetupIntent、嵌入式/跳转 Checkout | `pnpm e2e:server` |

覆盖率：`pnpm --filter @nexus-elements/server test:coverage` 要求 `apps/server/src` 行 / 语句 / 函数 ≥ 90%，分支 ≥ 85%（不含进程入口 `src/index.ts` 和纯类型文件）。这条命令需要 `DATABASE_URL`，否则 Postgres 仓储不会被计入覆盖率、阈值会失败。CI 用 GitHub Actions 的 Postgres service 提供该变量。

本地 Postgres：

```bash
docker compose up postgres -d
export DATABASE_URL=postgres://nexus:nexus@127.0.0.1:5432/nexus
pnpm --filter @nexus-elements/server test:coverage
```

内存后端不需要数据库，适合示例和 `pnpm e2e:server`：

```bash
pnpm --filter @nexus-elements/server build
pnpm e2e:server
```
