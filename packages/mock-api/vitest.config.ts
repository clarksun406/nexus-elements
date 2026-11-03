import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@nexus-elements\/contracts\/suite$/, replacement: fileURLToPath(new URL('../../packages/contracts/suite/run.ts', import.meta.url)) },
      { find: /^@nexus-elements\/contracts$/, replacement: fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
