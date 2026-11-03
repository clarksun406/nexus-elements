import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const contracts = fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url))
const suite = fileURLToPath(new URL('../../packages/contracts/suite/run.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@nexus-elements\/contracts\/suite$/, replacement: suite },
      { find: /^@nexus-elements\/contracts$/, replacement: contracts },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/types.ts', 'src/gateway/types.ts'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
