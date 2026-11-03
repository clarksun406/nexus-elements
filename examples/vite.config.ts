import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fieldsServerPlugin } from './plugins/fields-server'
import { mockApiPlugin } from '@nexus-elements/mock-api'

const apiTarget = process.env.NEXUS_API_TARGET

export default defineConfig({
  plugins: [vue(), ...(apiTarget ? [] : [mockApiPlugin()]), fieldsServerPlugin()],
  resolve: {
    alias: {
      '@nexus-elements/core': resolve(__dirname, '../packages/core/src'),
      '@nexus-elements/vue': resolve(__dirname, '../packages/vue/src'),
    },
  },
  server: {
    port: 3000,
    proxy: apiTarget
      ? {
          '/v1': { target: apiTarget, changeOrigin: true },
          '/3ds-mock': { target: apiTarget, changeOrigin: true },
          '/__nexus-checkout': { target: apiTarget, changeOrigin: true },
          '/health': { target: apiTarget, changeOrigin: true },
        }
      : undefined,
  },
})
