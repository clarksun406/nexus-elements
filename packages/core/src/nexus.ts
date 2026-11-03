import { NexusElement } from './element'
import { NexusElements } from './elements'
import { ELEMENT_SANDBOX } from './iframe/manager'
import { followRedirect } from './navigation'
import type {
  ConfirmCardPaymentParams,
  ConfirmPaymentParams,
  ConfirmResult,
  ConfirmSetupParams,
  CheckoutSession,
  ElementsOptions,
  EmbeddedCheckoutInstance,
  EmbeddedCheckoutOptions,
  NexusOptions,
  PaymentIntent,
  SetupIntent,
} from './types'

export class Nexus {
  readonly publishableKey: string
  private apiBase: string
  private fieldsUrl?: string
  private nexusAccount?: string

  constructor(publishableKey: string, options: NexusOptions = {}) {
    if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
      throw new Error('Invalid publishable key. Expected format: pk_test_xxx or pk_live_xxx')
    }
    this.publishableKey = publishableKey
    this.apiBase = options.apiBase ?? ''
    this.fieldsUrl = options.fieldsUrl
    this.nexusAccount = options.nexusAccount
  }

  setFieldsUrl(url: string): void {
    this.fieldsUrl = url
  }

  elements(options: ElementsOptions = {}): NexusElements {
    return new NexusElements(this.publishableKey, options, {
      fieldsUrl: this.fieldsUrl,
      apiBase: this.apiBase,
      nexusAccount: this.nexusAccount,
    })
  }

  private apiHeaders(clientSecret?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Nexus-Key': this.publishableKey,
    }
    if (clientSecret) headers['X-Nexus-Client-Secret'] = clientSecret
    if (this.nexusAccount) headers['X-Nexus-Account'] = this.nexusAccount
    return headers
  }

  async confirmCardPayment(
    clientSecret: string,
    params: ConfirmCardPaymentParams,
  ): Promise<ConfirmResult<'payment'>> {
    const card = params.payment_method.card as NexusElement
    const tokenizeResult = await card.tokenize(clientSecret, params.payment_method.billing_details as unknown as Record<string, unknown>)

    if (tokenizeResult.error) {
      return {
        error: {
          type: 'card_error',
          code: tokenizeResult.error.code,
          message: tokenizeResult.error.message,
        },
      }
    }

    try {
      const response = await fetch(`${this.apiBase}/v1/payment_intents/confirm`, {
        method: 'POST',
        headers: this.apiHeaders(clientSecret),
        body: JSON.stringify({
          payment_method_token: tokenizeResult.token ?? tokenizeResult.paymentMethodId,
          receipt_email: params.receipt_email,
          return_url: params.return_url,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          error: {
            type: data.error?.type ?? 'api_error',
            code: data.error?.code,
            message: data.error?.message ?? 'Payment confirmation failed.',
            decline_code: data.error?.decline_code,
            payment_intent: data.error?.payment_intent,
          },
        }
      }

      const paymentIntent = data.payment_intent as PaymentIntent

      if (paymentIntent.status === 'requires_action' && data.next_action?.redirect_url) {
        followRedirect(data.next_action.redirect_url)
      }

      return { paymentIntent }
    } catch {
      return {
        error: { type: 'network_error', message: 'A network error occurred while confirming the payment.' },
      }
    }
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmResult<'payment'>> {
    const elements = params.elements as NexusElements | undefined
    const clientSecret = params.clientSecret ?? elements?.getClientSecret()
    if (!clientSecret) {
      return { error: { type: 'validation_error', message: 'clientSecret is required.' } }
    }

    let paymentMethodToken: string | undefined = params.paymentMethodId

    if (!paymentMethodToken) {
      if (!elements) {
        return { error: { type: 'validation_error', message: 'Either elements or paymentMethodId is required.' } }
      }

      const mountedElements = this.findMountedElements(elements)
      const paymentElement = mountedElements.find((el) => el.type === 'payment') ?? mountedElements[0]
      if (!paymentElement) {
        return { error: { type: 'validation_error', message: 'No mounted element found.' } }
      }

      const billingDetails = params.confirmParams?.payment_method_data?.billing_details
      const tokenizeResult = await paymentElement.tokenize(clientSecret, billingDetails as unknown as Record<string, unknown>)

      if (tokenizeResult.error) {
        return {
          error: {
            type: 'card_error',
            code: tokenizeResult.error.code,
            message: tokenizeResult.error.message,
          },
        }
      }

      paymentMethodToken = tokenizeResult.token ?? tokenizeResult.paymentMethodId
    }

    try {
      const response = await fetch(`${this.apiBase}/v1/payment_intents/confirm`, {
        method: 'POST',
        headers: this.apiHeaders(clientSecret),
        body: JSON.stringify({
          payment_method_token: paymentMethodToken,
          return_url: params.confirmParams?.return_url,
          receipt_email: params.confirmParams?.receipt_email,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          error: {
            type: data.error?.type ?? 'api_error',
            code: data.error?.code,
            message: data.error?.message ?? 'Payment confirmation failed.',
            decline_code: data.error?.decline_code,
            payment_intent: data.error?.payment_intent,
          },
        }
      }

      const paymentIntent = data.payment_intent as PaymentIntent

      if (paymentIntent.status === 'requires_action' && params.redirect !== 'if_required') {
        if (data.next_action?.redirect_url) {
          followRedirect(data.next_action.redirect_url)
          return { paymentIntent }
        }
      }

      return { paymentIntent }
    } catch {
      return {
        error: { type: 'network_error', message: 'A network error occurred while confirming the payment.' },
      }
    }
  }

  async confirmSetup(params: ConfirmSetupParams): Promise<ConfirmResult<'setup'>> {
    const elements = params.elements as NexusElements
    const clientSecret = params.clientSecret ?? elements.getClientSecret()
    if (!clientSecret) {
      return { error: { type: 'validation_error', message: 'clientSecret is required.' } }
    }

    const mountedElements = this.findMountedElements(elements)
    const targetElement = mountedElements[0]
    if (!targetElement) {
      return { error: { type: 'validation_error', message: 'No mounted element found.' } }
    }

    const tokenizeResult = await targetElement.tokenize(clientSecret)
    if (tokenizeResult.error) {
      return {
        error: {
          type: 'card_error',
          code: tokenizeResult.error.code,
          message: tokenizeResult.error.message,
        },
      }
    }

    try {
      const response = await fetch(`${this.apiBase}/v1/setup_intents/confirm`, {
        method: 'POST',
        headers: this.apiHeaders(clientSecret),
        body: JSON.stringify({
          payment_method_token: tokenizeResult.token ?? tokenizeResult.paymentMethodId,
          return_url: params.confirmParams.return_url,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          error: {
            type: data.error?.type ?? 'api_error',
            code: data.error?.code,
            message: data.error?.message ?? 'Setup confirmation failed.',
          },
        }
      }

      return { setupIntent: data.setup_intent as SetupIntent }
    } catch {
      return {
        error: { type: 'network_error', message: 'A network error occurred while confirming the setup.' },
      }
    }
  }

  initEmbeddedCheckout(options: EmbeddedCheckoutOptions): EmbeddedCheckoutInstance {
    let iframe: HTMLIFrameElement | null = null
    let listener: ((event: MessageEvent) => void) | null = null

    const cleanup = () => {
      if (listener) {
        window.removeEventListener('message', listener)
        listener = null
      }
      iframe?.remove()
      iframe = null
    }

    return {
      mount(target: string | HTMLElement) {
        const container = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
        if (!container) throw new Error(`Mount target not found: ${target}`)

        const baseUrl = options.checkoutUrl ?? '/__nexus-checkout/index.html'
        const separator = baseUrl.includes('?') ? '&' : '?'
        iframe = document.createElement('iframe')
        iframe.src = `${baseUrl}${separator}clientSecret=${encodeURIComponent(options.clientSecret)}`
        iframe.title = 'Nexus embedded checkout'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.setAttribute('sandbox', ELEMENT_SANDBOX)
        iframe.setAttribute('referrerpolicy', 'no-referrer')
        container.appendChild(iframe)
        const checkoutOrigin = new URL(iframe.src, window.location.href).origin

        listener = (event: MessageEvent) => {
          if (!iframe || event.source !== iframe.contentWindow) return
          if (event.origin !== checkoutOrigin) return
          const data = event.data as { type?: string; url?: string; session?: { id: string; status: string; payment_intent?: string } }
          if (data?.type === 'nexus:checkout-complete' && data.session) {
            options.onComplete?.(data.session)
          }
          if (data?.type === 'nexus:checkout-redirect' && data.url) {
            followRedirect(data.url)
          }
        }
        window.addEventListener('message', listener)
      },
      unmount: cleanup,
      destroy: cleanup,
    }
  }

  redirectToCheckout(session: CheckoutSession): void {
    if (!session.url) {
      throw new Error('Checkout session has no URL.')
    }
    followRedirect(session.url)
  }

  private findMountedElements(elements: NexusElements): NexusElement[] {
    const result: NexusElement[] = []
    const bridge = elements.getBridge()
    void bridge
    // Access internal elements via getElement — elements are tracked by the NexusElements instance
    const anyElements = elements as unknown as { elements: Map<string, NexusElement> }
    for (const element of anyElements.elements.values()) {
      if (element.isMounted()) result.push(element)
    }
    return result
  }
}
