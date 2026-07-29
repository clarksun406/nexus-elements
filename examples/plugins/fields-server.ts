import type { Plugin, Connect } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

export function fieldsServerPlugin(): Plugin {
  const fieldsDist = resolve(__dirname, '../../packages/fields/dist')

  return {
    name: 'nexus-fields-server',
    configureServer(server) {
      server.middlewares.use('/fields', ((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const url = (req.url ?? '/').split('?')[0]
        const filePath = join(fieldsDist, url === '/' ? 'index.html' : url)

        if (!filePath.startsWith(fieldsDist) || !existsSync(filePath)) {
          res.statusCode = 404
          res.end('Fields not built. Run: pnpm --filter @nexus-elements/fields build')
          return
        }

        const ext = extname(filePath)
        res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
        res.end(readFileSync(filePath))
      }) as Connect.Handle)
    },
  }
}
