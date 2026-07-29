import { createServer, type Server } from 'node:http'
import { MockStore } from './store.js'
import { createRequestHandler } from './router.js'

export interface MockServerOptions {
  port?: number
  host?: string
}

export function createMockServer(options: MockServerOptions = {}): Promise<Server> {
  const { port = 3001, host = '127.0.0.1' } = options
  const store = new MockStore()
  const handler = createRequestHandler(store)

  const server = createServer((req, res) => {
    handler(req, res)
  })

  return new Promise<Server>((resolve) => {
    server.listen(port, host, () => {
      console.log(`[mock-api] Server running at http://${host}:${port}`)
      resolve(server)
    })
  })
}

const invokedPath = process.argv[1] ?? ''
if (invokedPath.endsWith('server.js') || invokedPath.endsWith('server.cjs')) {
  const port = parseInt(process.env['MOCK_PORT'] ?? '3001', 10)
  createMockServer({ port })
}
