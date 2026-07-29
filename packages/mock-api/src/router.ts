import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MockStore } from './store.js'
import { readBody, errorResponse } from './utils.js'
import { threeDsPage, checkoutPage } from './templates.js'
import { handleCreateToken } from './handlers/tokens.js'
import {
  handleCreatePaymentIntent,
  handleConfirmPaymentIntent,
  handleUpdatePaymentIntent,
  handleCancelPaymentIntent,
} from './handlers/payment-intents.js'
import { handleCreateSetupIntent, handleConfirmSetupIntent } from './handlers/setup-intents.js'
import {
  handleCreateCheckoutSession,
  handleGetCheckoutSession,
  handleConfirmCheckoutSession,
} from './handlers/checkout.js'
import { handleComplete3ds, handleGetPaymentMethods, handleGetEncryptionKey } from './handlers/misc.js'

export function createRequestHandler(store: MockStore) {
  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl: string = (req.url ?? '/').split('?')[0]!
    const method = req.method ?? 'GET'

    try {
      // 3DS mock challenge page
      if (rawUrl === '/3ds-mock' && method === 'GET') {
        const params = new URLSearchParams(req.url?.split('?')[1] ?? '')
        const intentId = params.get('intent') ?? ''
        const returnUrl = params.get('return_url') ?? '/'
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(threeDsPage(intentId, returnUrl))
        return
      }

      // 3DS completion
      if (rawUrl === '/v1/3ds/complete' && method === 'POST') {
        const body = await readBody(req)
        handleComplete3ds(store, res, body)
        return
      }

      // Hosted embedded checkout page
      if (rawUrl === '/__nexus-checkout' && method === 'GET') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(checkoutPage())
        return
      }

      // State reset endpoint
      if (rawUrl === '/__mock/reset' && method === 'POST') {
        store.reset()
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ ok: true }))
        return
      }

      // All /v1/* routes
      if (rawUrl.startsWith('/v1')) {
        const url = rawUrl.slice(3) // strip /v1 prefix
        let body: Record<string, unknown> = {}
        if (method === 'POST') {
          body = await readBody(req)
        }

        // POST /v1/tokens
        if (method === 'POST' && url === '/tokens') {
          handleCreateToken(store, res, body)
          return
        }

        // GET /v1/payment_methods
        if (method === 'GET' && url === '/payment_methods') {
          handleGetPaymentMethods(res)
          return
        }

        // POST /v1/payment_intents
        if (method === 'POST' && url === '/payment_intents') {
          handleCreatePaymentIntent(store, res, body)
          return
        }

        // POST /v1/payment_intents/confirm
        if (method === 'POST' && url === '/payment_intents/confirm') {
          handleConfirmPaymentIntent(store, req, res, body)
          return
        }

        // POST /v1/payment_intents/:id (update)
        const updateMatch = url.match(/^\/payment_intents\/(pi_test_\d+)$/)
        if (method === 'POST' && updateMatch) {
          handleUpdatePaymentIntent(store, res, updateMatch[1]!, body)
          return
        }

        // POST /v1/payment_intents/:id/cancel
        const cancelMatch = url.match(/^\/payment_intents\/(pi_test_\d+)\/cancel$/)
        if (method === 'POST' && cancelMatch) {
          handleCancelPaymentIntent(store, res, cancelMatch[1]!)
          return
        }

        // POST /v1/setup_intents
        if (method === 'POST' && url === '/setup_intents') {
          handleCreateSetupIntent(store, res, body)
          return
        }

        // POST /v1/setup_intents/confirm
        if (method === 'POST' && url === '/setup_intents/confirm') {
          handleConfirmSetupIntent(store, req, res, body)
          return
        }

        // POST /v1/checkout/sessions
        if (method === 'POST' && url === '/checkout/sessions') {
          handleCreateCheckoutSession(store, res, body)
          return
        }

        // GET /v1/checkout/sessions/:id
        const sessionGetMatch = url.match(/^\/checkout\/sessions\/(cs_test_\d+)$/)
        if (method === 'GET' && sessionGetMatch) {
          handleGetCheckoutSession(store, req, res, sessionGetMatch[1]!)
          return
        }

        // POST /v1/checkout/sessions/:id/confirm
        const sessionConfirmMatch = url.match(/^\/checkout\/sessions\/(cs_test_\d+)\/confirm$/)
        if (method === 'POST' && sessionConfirmMatch) {
          handleConfirmCheckoutSession(store, req, res, sessionConfirmMatch[1]!, body)
          return
        }

        // GET /v1/encryption_key
        if (method === 'GET' && url === '/encryption_key') {
          handleGetEncryptionKey(res)
          return
        }

        errorResponse(res, 404, 'api_error', 'unknown_endpoint', `未知接口: ${method} ${url}`)
        return
      }

      errorResponse(res, 404, 'api_error', 'unknown_endpoint', `未知接口: ${method} ${rawUrl}`)
    } catch (err) {
      errorResponse(res, 500, 'api_error', 'internal_error', (err as Error).message)
    }
  }
}
