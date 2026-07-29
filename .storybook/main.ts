import type { StorybookConfig } from '@storybook/vue3-vite'
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mockApiPlugin } from '@nexus-elements/mock-api'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

function storybookPlugins(): Plugin[] {
  const fieldsDist = resolve(import.meta.dirname, '../packages/fields/dist')

  return [
    {
      name: 'nexus-storybook-fields',
      configureServer(server) {
        server.middlewares.use('/__nexus-fields', (req, res, next) => {
          const url = (req.url ?? '/').split('?')[0]
          const filePath = join(fieldsDist, url === '/' ? 'index.html' : url)
          if (!filePath.startsWith(fieldsDist) || !existsSync(filePath)) {
            next()
            return
          }
          const ext = extname(filePath)
          res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
          res.end(readFileSync(filePath))
        })
      },
    },
  ]
}

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|ts)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/vue3-vite',
  viteFinal: async (config) => {
    config.resolve ??= {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@nexus-elements/core': resolve(import.meta.dirname, '../packages/core/src/index.ts'),
      '@nexus-elements/vue': resolve(import.meta.dirname, '../packages/vue/src/index.ts'),
      '@nexus-elements/mock-api': resolve(import.meta.dirname, '../packages/mock-api/src/index.ts'),
    }
    config.plugins = [vue(), ...(config.plugins ?? []), ...storybookPlugins(), mockApiPlugin()]
    return config
  },
}

export default config