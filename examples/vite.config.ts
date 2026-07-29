import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fieldsServerPlugin } from './plugins/fields-server'
import { mockApiPlugin } from '@nexus-elements/mock-api'

export default defineConfig({
  plugins: [vue(), mockApiPlugin(), fieldsServerPlugin()],
  resolve: {
    alias: {
      '@nexus-elements/core': resolve(__dirname, '../packages/core/src'),
      '@nexus-elements/vue': resolve(__dirname, '../packages/vue/src'),
    },
  },
  server: {
    port: 3000,
  },
})
