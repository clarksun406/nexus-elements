import type { Plugin, Connect } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface MockPaymentIntent {
  id: string
  object: 'payment_intent'
  amount: number
  currency: string
  status: string
  client_secret: string
  description?: string
  metadata?: Record<string, string>
  payment_method_types: string[]
  payment_method?: string
  created: number
}

interface MockToken {
  token: string
  payment_method_id: string
  type: string
  card_number?: string
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
  redirect_method?: Record<string, unknown>
  billing_details?: Record<string, unknown>
  used: boolean
  expires_at: number
}

const DECLINE_CARDS: Record<string, { code: string; decline_code: string; message: string }> = {
  '4000000000009995': { code: 'card_declined', decline_code: 'insufficient_funds', message: '您的卡余额不足，请更换支付方式。' },
  '4000000000000002': { code: 'card_declined', decline_code: 'generic_decline', message: '您的卡被拒绝，请联系发卡行。' },
  '4000000000000069': { code: 'expired_card', decline_code: 'expired_card', message: '您的卡已过期。' },
  '4000000000000127': { code: 'incorrect_cvc', decline_code: 'incorrect_cvc', message: '您的卡安全码错误。' },
}

const THREE_DS_CARD = '4000000000003220'

interface MockSetupIntent {
  id: string
  object: 'setup_intent'
  status: string
  client_secret: string
  usage: string
  payment_method?: string
  created: number
}

interface MockCheckoutSession {
  id: string
  object: 'checkout.session'
  status: string
  mode: string
  ui_mode: string
  amount: number
  currency: string
  line_items: Array<{ name: string; amount: number; quantity: number }>
  success_url?: string
  cancel_url?: string
  client_secret: string
  url: string
  payment_intent?: string
  created: number
}

let intentCounter = 0
let tokenCounter = 0
let setupCounter = 0
let checkoutCounter = 0

const intents = new Map<string, MockPaymentIntent>()
const tokens = new Map<string, MockToken>()
const setupIntents = new Map<string, MockSetupIntent>()
const checkoutSessions = new Map<string, MockCheckoutSession>()

const SAVED_PAYMENT_METHODS = [
  { id: 'pm_saved_1', object: 'payment_method', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 } },
  { id: 'pm_saved_2', object: 'payment_method', type: 'card', card: { brand: 'mastercard', last4: '4444', exp_month: 6, exp_year: 2027 } },
]

function detectBrand(number: string): string {
  if (number.startsWith('4')) return 'visa'
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard'
  if (/^3[47]/.test(number)) return 'amex'
  if (/^62/.test(number)) return 'unionpay'
  if (/^35/.test(number)) return 'jcb'
  return 'unknown'
}

function luhnValid(number: string): boolean {
  let sum = 0
  let alternate = false
  for (let i = number.length - 1; i >= 0; i--) {
    let n = number.charCodeAt(i) - 48
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        resolvePromise(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(data))
}

function errorResponse(res: ServerResponse, status: number, type: string, code: string, message: string, extra?: Record<string, unknown>): void {
  json(res, status, { error: { type, code, message, ...extra } })
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'nexus-mock-api',
    configureServer(server) {
      // 3DS mock challenge page (registered before /v1 catch-all)
      server.middlewares.use('/3ds-mock', (req: IncomingMessage, res: ServerResponse) => {
        const params = new URLSearchParams(req.url?.split('?')[1] ?? '')
        const intentId = params.get('intent') ?? ''
        const returnUrl = params.get('return_url') ?? '/'

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<!DOCTYPE html>
<html><head><title>3DS 验证（模拟）</title>
<style>
  body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f6f8fa; }
  .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.1); text-align: center; max-width: 400px; }
  button { margin: 8px; padding: 12px 24px; border-radius: 8px; border: none; font-size: 15px; cursor: pointer; }
  .approve { background: #635bff; color: #fff; }
  .decline { background: #eee; color: #333; }
</style></head>
<body><div class="card">
  <h2>3D Secure 验证（模拟）</h2>
  <p>银行要求额外身份验证<br/>Intent: ${intentId}</p>
  <button class="approve" onclick="complete('approved')">验证通过</button>
  <button class="decline" onclick="complete('failed')">验证失败</button>
</div>
<script>
  function complete(status) {
    fetch('/v1/3ds/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: '${intentId}', status: status })
    }).then(function() {
      var sep = '${returnUrl}'.indexOf('?') >= 0 ? '&' : '?';
      window.location.href = '${returnUrl}' + sep + 'status=' + status + '&intent=${intentId}';
    });
  }
</script>
</body></html>`)
      })

      // 3DS completion endpoint (registered before /v1 catch-all)
      server.middlewares.use('/v1/3ds/complete', (async (req: IncomingMessage, res: ServerResponse) => {
        const body = await readBody(req)
        const intent = intents.get(body.intent as string)
        if (intent && intent.status === 'requires_action') {
          intent.status = body.status === 'approved' ? 'succeeded' : 'requires_payment_method'
        }
        json(res, 200, { ok: true })
      }) as Connect.NextHandleFunction)

      // Hosted embedded checkout page (CFM-004)
      server.middlewares.use('/__nexus-checkout', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>Nexus Checkout</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 0; background: #f6f8fa; color: #1f2937; }
  .checkout { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
  .summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .summary h2 { margin: 0 0 12px; font-size: 15px; color: #6b7280; font-weight: 600; }
  .line-item { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; }
  .total { display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 16px; }
  form { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  label { display: block; font-size: 13px; color: #4b5563; margin: 10px 0 4px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; }
  input:focus { outline: none; border-color: #635bff; box-shadow: 0 0 0 3px rgba(99,91,255,.15); }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  button { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 8px; background: #635bff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .error { color: #dc2626; font-size: 13px; margin-top: 10px; min-height: 18px; }
  .success { background: #fff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 32px 16px; text-align: center; display: none; }
  .success .mark { width: 48px; height: 48px; border-radius: 50%; background: #059669; color: #fff; font-size: 26px; line-height: 48px; margin: 0 auto 12px; }
</style></head>
<body>
<div class="checkout">
  <div class="summary">
    <h2 id="cs-name">订单</h2>
    <div id="cs-items"></div>
    <div class="total"><span>合计</span><span id="cs-total">--</span></div>
  </div>
  <form id="cs-form">
    <label>卡号</label>
    <input id="cs-number" class="checkout-number" autocomplete="cc-number" placeholder="1234 1234 1234 1234" required />
    <div class="row">
      <div><label>有效期 (MM/YY)</label><input id="cs-expiry" class="checkout-expiry" autocomplete="cc-exp" placeholder="MM/YY" required /></div>
      <div><label>CVC</label><input id="cs-cvc" class="checkout-cvc" autocomplete="cc-csc" placeholder="CVC" required /></div>
    </div>
    <button id="cs-pay" type="submit">支付</button>
    <p class="error" id="cs-error" role="alert"></p>
  </form>
  <div class="success" id="cs-success">
    <div class="mark">✓</div>
    <h2>支付成功</h2>
    <p id="cs-success-detail"></p>
  </div>
</div>
<script>
(function () {
  var params = new URLSearchParams(location.search)
  var clientSecret = params.get('clientSecret') || ''
  var sessionId = clientSecret.split('_secret')[0]
  var session = null

  function fmt(amount, currency) {
    var symbol = currency === 'cny' ? '¥' : currency === 'usd' ? '$' : currency === 'eur' ? '€' : currency.toUpperCase() + ' '
    return symbol + (amount / 100).toFixed(2)
  }

  fetch('/v1/checkout/sessions/' + sessionId, { headers: { 'X-Nexus-Client-Secret': clientSecret } })
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (!data.checkout_session) {
        document.getElementById('cs-error').textContent = (data.error && data.error.message) || '会话加载失败'
        document.getElementById('cs-pay').disabled = true
        return
      }
      session = data.checkout_session
      var items = document.getElementById('cs-items')
      session.line_items.forEach(function (item) {
        var row = document.createElement('div')
        row.className = 'line-item'
        row.innerHTML = '<span></span><span></span>'
        row.children[0].textContent = item.name + ' × ' + item.quantity
        row.children[1].textContent = fmt(item.amount * item.quantity, session.currency)
        items.appendChild(row)
      })
      document.getElementById('cs-total').textContent = fmt(session.amount, session.currency)
    })

  document.getElementById('cs-form').addEventListener('submit', function (e) {
    e.preventDefault()
    if (!session) return
    var errorEl = document.getElementById('cs-error')
    errorEl.textContent = ''
    var payBtn = document.getElementById('cs-pay')
    payBtn.disabled = true
    payBtn.textContent = '处理中...'

    var number = document.getElementById('cs-number').value.replace(/\\D/g, '')
    var expiry = document.getElementById('cs-expiry').value.replace(/\\D/g, '')
    var cvc = document.getElementById('cs-cvc').value.trim()
    var expMonth = parseInt(expiry.slice(0, 2), 10)
    var expYear = 2000 + parseInt(expiry.slice(2, 4), 10)

    fetch('/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: { number: number, exp_month: expMonth, exp_year: expYear, cvc: cvc } }),
    })
      .then(function (r) { return r.json() })
      .then(function (tokenData) {
        if (tokenData.error) throw new Error(tokenData.error.message)
        return fetch('/v1/checkout/sessions/' + session.id + '/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Nexus-Client-Secret': clientSecret },
          body: JSON.stringify({ payment_method_token: tokenData.token }),
        })
      })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.error) throw new Error(data.error.message)
        session = data.checkout_session
        document.getElementById('cs-form').style.display = 'none'
        var successEl = document.getElementById('cs-success')
        successEl.style.display = 'block'
        document.getElementById('cs-success-detail').textContent = session.id + ' · ' + fmt(session.amount, session.currency)
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'nexus:checkout-complete', session: { id: session.id, status: session.status, payment_intent: session.payment_intent } }, location.origin)
        }
        if (session.ui_mode === 'redirect' && session.success_url) {
          window.top.location.href = session.success_url.replace('{SESSION_ID}', session.id)
        }
      })
      .catch(function (err) {
        errorEl.textContent = err.message || '支付失败，请重试。'
        payBtn.disabled = false
        payBtn.textContent = '支付'
      })
  })
})()
</script>
</body></html>`)
      })

      // Main API catch-all
      server.middlewares.use('/v1', (async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const url = (req.url ?? '/').split('?')[0]
        const method = req.method ?? 'GET'

        try {
          // POST /v1/tokens
          if (method === 'POST' && url === '/tokens') {
            const body = await readBody(req)

            const paymentMethodType = body.payment_method_type as string | undefined
            if (paymentMethodType) {
              const token: MockToken = {
                token: `tok_test_${++tokenCounter}`,
                payment_method_id: `pm_test_${tokenCounter}`,
                type: paymentMethodType,
                redirect_method: body[paymentMethodType] as Record<string, unknown> | undefined,
                billing_details: body.billing_details as Record<string, unknown> | undefined,
                used: false,
                expires_at: Date.now() + 5 * 60 * 1000,
              }
              tokens.set(token.token, token)
              tokens.set(token.payment_method_id, token)

              return json(res, 200, {
                token: token.token,
                payment_method_id: token.payment_method_id,
                type: paymentMethodType,
                [paymentMethodType]: token.redirect_method ?? {},
              })
            }

            const card = body.card as { number?: string; exp_month?: number; exp_year?: number; cvc?: string } | undefined

            if (!card?.number) {
              return errorResponse(res, 400, 'validation_error', 'invalid_number', '卡号不能为空。')
            }

            const number = card.number.replace(/\D/g, '')
            if (number.length < 13 || number.length > 19 || !luhnValid(number)) {
              return errorResponse(res, 400, 'validation_error', 'invalid_number', '卡号无效，请检查后重试。')
            }

            if (card.exp_month === undefined || card.exp_year === undefined || !card.cvc) {
              return errorResponse(res, 400, 'validation_error', 'incomplete_card', '银行卡信息不完整：缺少有效期或安全码。')
            }

            const now = new Date()
            if (card.exp_month !== undefined && card.exp_year !== undefined) {
              const expiry = new Date(card.exp_year, card.exp_month)
              if (expiry <= now) {
                return errorResponse(res, 400, 'validation_error', 'invalid_expiry', '您的卡已过期。')
              }
            }

            const token: MockToken = {
              token: `tok_test_${++tokenCounter}`,
              payment_method_id: `pm_test_${tokenCounter}`,
              type: 'card',
              card_number: number,
              brand: detectBrand(number),
              last4: number.slice(-4),
              exp_month: card.exp_month ?? 12,
              exp_year: card.exp_year ?? now.getFullYear() + 2,
              billing_details: body.billing_details as Record<string, unknown> | undefined,
              used: false,
              expires_at: Date.now() + 5 * 60 * 1000,
            }
            tokens.set(token.token, token)
            tokens.set(token.payment_method_id, token)

            return json(res, 200, {
              token: token.token,
              payment_method_id: token.payment_method_id,
              type: 'card',
              card: {
                brand: token.brand,
                last4: token.last4,
                exp_month: token.exp_month,
                exp_year: token.exp_year,
                funding: 'credit',
                country: 'US',
              },
            })
          }

          // GET /v1/payment_methods（已保存的支付方式列表）
          if (method === 'GET' && url === '/payment_methods') {
            return json(res, 200, { data: SAVED_PAYMENT_METHODS })
          }

          // POST /v1/payment_intents
          if (method === 'POST' && url === '/payment_intents') {
            const body = await readBody(req)
            const amount = body.amount as number
            const currency = body.currency as string

            if (!amount || !Number.isInteger(amount) || amount <= 0) {
              return errorResponse(res, 400, 'validation_error', 'invalid_amount', '金额必须为正整数（最小单位）。')
            }

            const intent: MockPaymentIntent = {
              id: `pi_test_${++intentCounter}`,
              object: 'payment_intent',
              amount,
              currency: currency ?? 'cny',
              status: 'requires_payment_method',
              client_secret: `pi_test_${intentCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
              description: body.description as string | undefined,
              metadata: body.metadata as Record<string, string> | undefined,
              payment_method_types: (body.payment_method_types as string[]) ?? ['card'],
              created: Math.floor(Date.now() / 1000),
            }
            intents.set(intent.id, intent)
            intents.set(intent.client_secret, intent)

            return json(res, 200, { payment_intent: intent })
          }

          // POST /v1/payment_intents/confirm
          if (method === 'POST' && url === '/payment_intents/confirm') {
            const clientSecret = req.headers['x-nexus-client-secret'] as string
            const intent = clientSecret ? intents.get(clientSecret) : undefined

            if (!intent) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent，请检查 client_secret。')
            }

            if (intent.status === 'succeeded') {
              return errorResponse(res, 409, 'api_error', 'payment_intent_already_confirmed', '该支付已成功，请勿重复提交。', { payment_intent: intent })
            }

            if (intent.status !== 'requires_payment_method' && intent.status !== 'requires_action') {
              return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', `当前状态 ${intent.status} 不允许确认支付。`, { payment_intent: intent })
            }

            const body = await readBody(req)
            const tokenKey = body.payment_method_token as string

            // 已保存的支付方式（pm_saved_*）直接确认成功
            if (tokenKey?.startsWith('pm_saved_')) {
              const saved = SAVED_PAYMENT_METHODS.find((entry) => entry.id === tokenKey)
              if (!saved) {
                return errorResponse(res, 400, 'validation_error', 'invalid_token', '未找到对应的已保存支付方式。')
              }
              intent.payment_method = saved.id
              intent.status = 'succeeded'
              return json(res, 200, { payment_intent: intent })
            }

            const token = tokenKey ? tokens.get(tokenKey) : undefined

            if (!token) {
              return errorResponse(res, 400, 'validation_error', 'invalid_token', '支付 token 无效或已过期。')
            }

            if (token.used) {
              return errorResponse(res, 400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。')
            }

            if (Date.now() > token.expires_at) {
              return errorResponse(res, 400, 'validation_error', 'token_expired', 'token 已过期（5分钟有效），请重新提交卡信息。')
            }

            token.used = true

            // 测试卡号行为
            const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
            if (decline) {
              intent.status = 'requires_payment_method'
              return json(res, 402, {
                error: {
                  type: 'card_error',
                  code: decline.code,
                  decline_code: decline.decline_code,
                  message: decline.message,
                  payment_intent: intent,
                },
              })
            }

            intent.payment_method = token.payment_method_id

            if (token.card_number === THREE_DS_CARD) {
              intent.status = 'requires_action'
              return json(res, 200, {
                payment_intent: intent,
                next_action: {
                  type: 'redirect',
                  redirect_url: `/3ds-mock?intent=${intent.id}&return_url=${encodeURIComponent((body.return_url as string) ?? '/')}`,
                },
              })
            }

            intent.status = 'succeeded'
            return json(res, 200, { payment_intent: intent })
          }

          // POST /v1/payment_intents/:id (update)
          const updateMatch = url.match(/^\/payment_intents\/(pi_test_\d+)$/)
          if (method === 'POST' && updateMatch) {
            const intent = intents.get(updateMatch[1])
            if (!intent) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
            }

            const body = await readBody(req)
            const updatable = ['amount', 'currency', 'description', 'metadata', 'receipt_email', 'payment_method_types'] as const

            if (intent.status !== 'requires_payment_method' && (body.amount || body.currency || body.payment_method_types)) {
              return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', '当前状态不允许修改金额/币种/支付方式。')
            }

            for (const field of updatable) {
              if (body[field] !== undefined) {
                ;(intent as Record<string, unknown>)[field] = body[field]
              }
            }

            return json(res, 200, { payment_intent: intent })
          }

          // POST /v1/payment_intents/:id/cancel
          const cancelMatch = url.match(/^\/payment_intents\/(pi_test_\d+)\/cancel$/)
          if (method === 'POST' && cancelMatch) {
            const intent = intents.get(cancelMatch[1])
            if (!intent) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 PaymentIntent。')
            }
            if (intent.status === 'succeeded') {
              return errorResponse(res, 409, 'api_error', 'payment_intent_unexpected_state', '已成功的支付不能取消。')
            }
            intent.status = 'canceled'
            return json(res, 200, { payment_intent: intent })
          }

          // POST /v1/setup_intents
          if (method === 'POST' && url === '/setup_intents') {
            const body = await readBody(req)
            const setupIntent: MockSetupIntent = {
              id: `seti_test_${++setupCounter}`,
              object: 'setup_intent',
              status: 'requires_payment_method',
              client_secret: `seti_test_${setupCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
              usage: (body.usage as string) ?? 'off_session',
              created: Math.floor(Date.now() / 1000),
            }
            setupIntents.set(setupIntent.id, setupIntent)
            setupIntents.set(setupIntent.client_secret, setupIntent)
            return json(res, 200, { setup_intent: setupIntent })
          }

          // POST /v1/setup_intents/confirm
          if (method === 'POST' && url === '/setup_intents/confirm') {
            const clientSecret = req.headers['x-nexus-client-secret'] as string
            const setupIntent = clientSecret ? setupIntents.get(clientSecret) : undefined

            if (!setupIntent) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 SetupIntent，请检查 client_secret。')
            }
            if (setupIntent.status === 'succeeded') {
              return errorResponse(res, 409, 'api_error', 'setup_intent_already_confirmed', '该 SetupIntent 已成功，请勿重复提交。')
            }

            const body = await readBody(req)
            const tokenKey = body.payment_method_token as string
            const token = tokenKey ? tokens.get(tokenKey) : undefined

            if (!token) {
              return errorResponse(res, 400, 'validation_error', 'invalid_token', '支付 token 无效或已过期。')
            }
            if (token.used) {
              return errorResponse(res, 400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。')
            }
            if (Date.now() > token.expires_at) {
              return errorResponse(res, 400, 'validation_error', 'token_expired', 'token 已过期（5分钟有效），请重新提交卡信息。')
            }

            token.used = true

            const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
            if (decline) {
              setupIntent.status = 'requires_payment_method'
              return json(res, 402, {
                error: {
                  type: 'card_error',
                  code: decline.code,
                  decline_code: decline.decline_code,
                  message: decline.message,
                },
              })
            }

            setupIntent.payment_method = token.payment_method_id
            setupIntent.status = 'succeeded'
            return json(res, 200, { setup_intent: setupIntent })
          }

          // POST /v1/checkout/sessions
          if (method === 'POST' && url === '/checkout/sessions') {
            const body = await readBody(req)
            const amount = body.amount as number
            if (!amount || !Number.isInteger(amount) || amount <= 0) {
              return errorResponse(res, 400, 'validation_error', 'invalid_amount', '金额必须为正整数（最小单位）。')
            }

            const id = `cs_test_${++checkoutCounter}`
            const clientSecret = `${id}_secret_${Math.random().toString(36).slice(2, 10)}`
            const session: MockCheckoutSession = {
              id,
              object: 'checkout.session',
              status: 'open',
              mode: (body.mode as string) ?? 'payment',
              ui_mode: (body.ui_mode as string) ?? 'embedded',
              amount,
              currency: (body.currency as string) ?? 'cny',
              line_items: (body.line_items as MockCheckoutSession['line_items']) ?? [],
              success_url: body.success_url as string | undefined,
              cancel_url: body.cancel_url as string | undefined,
              client_secret: clientSecret,
              url: `/__nexus-checkout/index.html?clientSecret=${encodeURIComponent(clientSecret)}`,
              created: Math.floor(Date.now() / 1000),
            }
            checkoutSessions.set(session.id, session)
            checkoutSessions.set(session.client_secret, session)
            return json(res, 200, { checkout_session: session })
          }

          // GET /v1/checkout/sessions/:id
          const sessionGetMatch = url.match(/^\/checkout\/sessions\/(cs_test_\d+)$/)
          if (method === 'GET' && sessionGetMatch) {
            const session = checkoutSessions.get(sessionGetMatch[1])
            if (!session) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 Checkout Session。')
            }
            const providedSecret = req.headers['x-nexus-client-secret'] as string | undefined
            if (providedSecret !== session.client_secret) {
              return errorResponse(res, 401, 'api_error', 'invalid_client_secret', 'client_secret 无效。')
            }
            return json(res, 200, { checkout_session: session })
          }

          // POST /v1/checkout/sessions/:id/confirm
          const sessionConfirmMatch = url.match(/^\/checkout\/sessions\/(cs_test_\d+)\/confirm$/)
          if (method === 'POST' && sessionConfirmMatch) {
            const session = checkoutSessions.get(sessionConfirmMatch[1])
            if (!session) {
              return errorResponse(res, 404, 'api_error', 'resource_missing', '未找到对应的 Checkout Session。')
            }
            if (session.status !== 'open') {
              return errorResponse(res, 409, 'api_error', 'session_not_open', `当前状态 ${session.status} 不允许支付。`)
            }
            const providedSecret = req.headers['x-nexus-client-secret'] as string | undefined
            if (providedSecret !== session.client_secret) {
              return errorResponse(res, 401, 'api_error', 'invalid_client_secret', 'client_secret 无效。')
            }

            const body = await readBody(req)
            const tokenKey = body.payment_method_token as string
            const token = tokenKey ? tokens.get(tokenKey) : undefined
            if (!token) {
              return errorResponse(res, 400, 'validation_error', 'invalid_token', '支付 token 无效或已过期。')
            }
            if (token.used) {
              return errorResponse(res, 400, 'validation_error', 'token_already_used', '该 token 已被使用，请重新获取。')
            }
            if (Date.now() > token.expires_at) {
              return errorResponse(res, 400, 'validation_error', 'token_expired', 'token 已过期（5分钟有效），请重新提交卡信息。')
            }
            token.used = true

            const decline = token.card_number ? DECLINE_CARDS[token.card_number] : undefined
            if (decline) {
              return json(res, 402, {
                error: { type: 'card_error', code: decline.code, decline_code: decline.decline_code, message: decline.message },
              })
            }

            const intent: MockPaymentIntent = {
              id: `pi_test_${++intentCounter}`,
              object: 'payment_intent',
              amount: session.amount,
              currency: session.currency,
              status: 'succeeded',
              client_secret: `pi_test_${intentCounter}_secret_${Math.random().toString(36).slice(2, 10)}`,
              payment_method_types: ['card'],
              payment_method: token.payment_method_id,
              created: Math.floor(Date.now() / 1000),
            }
            intents.set(intent.id, intent)
            session.status = 'complete'
            session.payment_intent = intent.id
            return json(res, 200, { checkout_session: session })
          }

          // GET /v1/encryption_key (Phase 1 stub — TLS only)
          if (method === 'GET' && url === '/encryption_key') {
            return json(res, 200, {
              key_id: 'ek_test_disabled',
              algorithm: 'none',
              public_key_pem: null,
              expires_at: Math.floor(Date.now() / 1000) + 86400,
              note: 'Phase 1: TLS-only encryption. Application-layer encryption will be enabled in a future phase.',
            })
          }

          return errorResponse(res, 404, 'api_error', 'unknown_endpoint', `未知接口: ${method} ${url}`)
        } catch (err) {
          return errorResponse(res, 500, 'api_error', 'internal_error', (err as Error).message)
        }
      }) as Connect.NextHandleFunction)
    },
  }
}
