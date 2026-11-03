export interface WalletPaymentRequest {
  amount: number
  currency: string
  label: string
  countryCode?: string
}

interface ApplePaySessionLike {
  begin: () => void
  abort: () => void
  completeMerchantValidation: (merchantSession: unknown) => void
  completePayment: (status: number) => void
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null
  onpaymentauthorized: ((event: { payment: { token: unknown } }) => void) | null
  oncancel: (() => void) | null
}

interface ApplePaySessionCtor {
  canMakePayments?: () => boolean
  new (version: number, request: unknown): ApplePaySessionLike
  STATUS_SUCCESS: number
  STATUS_FAILURE: number
}

function applePaySession(): ApplePaySessionCtor | undefined {
  return (window as unknown as { ApplePaySession?: ApplePaySessionCtor }).ApplePaySession
}

export function isApplePayAvailable(): boolean {
  try {
    return applePaySession()?.canMakePayments?.() === true
  } catch {
    return false
  }
}

export function isGooglePayAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.PaymentRequest !== 'function') return false
  const ua = navigator.userAgent
  return /Chrome|Chromium|Edg|Android/i.test(ua) && !/iPhone|iPad/i.test(ua)
}

export function isSecureWalletContext(): boolean {
  return window.isSecureContext === true
}

/**
 * Start a real Apple Pay session when the browser supports it.
 * Resolves with the payment token, or null when the shopper cancels or the
 * merchant session endpoint is not a real Apple Pay merchant (demo fallback).
 */
export async function startApplePay(request: WalletPaymentRequest): Promise<string | null> {
  const Session = applePaySession()
  if (!Session || !isApplePayAvailable()) return null
  const session = new Session(3, {
    countryCode: request.countryCode ?? 'US',
    currencyCode: request.currency.toUpperCase(),
    supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
    merchantCapabilities: ['supports3DS'],
    total: { label: request.label, amount: (request.amount / 100).toFixed(2) },
  })
  return new Promise((resolve) => {
    session.onvalidatemerchant = (event) => {
      void fetch('/v1/apple_pay/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validation_url: event.validationURL }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('merchant session unavailable')
          session.completeMerchantValidation(await response.json())
        })
        .catch(() => {
          session.abort()
          resolve(null)
        })
    }
    session.onpaymentauthorized = (event) => {
      session.completePayment(Session.STATUS_SUCCESS)
      const token = event.payment?.token
      resolve(typeof token === 'string' ? token : token ? JSON.stringify(token) : null)
    }
    session.oncancel = () => resolve(null)
    try {
      session.begin()
    } catch {
      resolve(null)
    }
  })
}

/** Payment Request API path for Google Pay. Returns null when unsupported. */
export async function startGooglePay(request: WalletPaymentRequest): Promise<string | null> {
  if (!isGooglePayAvailable()) return null
  try {
    const paymentRequest = new PaymentRequest(
      [{
        supportedMethods: 'https://google.com/pay',
        data: {
          environment: 'TEST',
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [{
            type: 'CARD',
            parameters: { allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'], allowedCardNetworks: ['VISA', 'MASTERCARD'] },
          }],
        },
      }],
      { total: { label: request.label, amount: { currency: request.currency.toUpperCase(), value: (request.amount / 100).toFixed(2) } } },
    )
    const canPay = await paymentRequest.canMakePayment()
    if (!canPay) return null
    const response = await paymentRequest.show()
    await response.complete('success')
    return JSON.stringify(response.details ?? {})
  } catch {
    return null
  }
}
