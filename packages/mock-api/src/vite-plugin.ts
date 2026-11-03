import type { Plugin } from 'vite'
import { MockStore } from './store.js'
import { createRequestHandler } from './router.js'
import { isCheckoutPath } from './security.js'

export function mockApiPlugin(): Plugin {
  const store = new MockStore()
  const handler = createRequestHandler(store)

  return {
    name: 'nexus-mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url: string = (req.url ?? '/').split('?')[0]!
        if (
          url === '/3ds-mock' ||
          url === '/v1/3ds/complete' ||
          isCheckoutPath(url) ||
          url === '/__mock/reset' ||
          url.startsWith('/v1')
        ) {
          handler(req, res)
          return
        }
        next()
      })
    },
  }
}
