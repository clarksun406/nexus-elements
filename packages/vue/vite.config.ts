import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NexusVue',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'nexus-vue.js' : 'nexus-vue.cjs'),
    },
    rollupOptions: {
      external: ['vue', '@nexus-elements/core'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },
    sourcemap: true,
  },
})
