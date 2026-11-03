import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/i18n/locales/**', 'src/**/*.d.ts'],
      thresholds: {
        lines: 85,
        statements: 85,
      },
    },
  },
})
