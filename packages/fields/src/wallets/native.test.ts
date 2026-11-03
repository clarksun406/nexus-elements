/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { isApplePayAvailable, isGooglePayAvailable, startApplePay, startGooglePay } from './native'

describe('native wallets', () => {
  it('detects Apple Pay and falls back when merchant validation fails', async () => {
    expect(isApplePayAvailable()).toBe(false)
    const session = {
      begin: vi.fn(),
      abort: vi.fn(),
      completeMerchantValidation: vi.fn(),
      completePayment: vi.fn(),
      onvalidatemerchant: null as ((event: { validationURL: string }) => void) | null,
      onpaymentauthorized: null as ((event: { payment: { token: unknown } }) => void) | null,
      oncancel: null as (() => void) | null,
    }
    class ApplePaySession {
      static canMakePayments() { return true }
      static STATUS_SUCCESS = 1
      static STATUS_FAILURE = 0
      constructor() { return session }
    }
    ;(window as unknown as { ApplePaySession: unknown }).ApplePaySession = ApplePaySession
    expect(isApplePayAvailable()).toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const pending = startApplePay({ amount: 1000, currency: 'usd', label: 'Demo' })
    session.begin.mockImplementation(() => {
      session.onvalidatemerchant?.({ validationURL: 'https://apple.test/validate' })
    })
    session.begin()
    await expect(pending).resolves.toBeNull()
    expect(session.abort).toHaveBeenCalled()
  })

  it('uses PaymentRequest for Google Pay and reports unavailability', async () => {
    expect(isGooglePayAvailable()).toBe(false)
    class PaymentRequest {
      canMakePayment = vi.fn().mockResolvedValue(true)
      show = vi.fn().mockResolvedValue({ details: { token: 'gpay' }, complete: vi.fn() })
    }
    vi.stubGlobal('PaymentRequest', PaymentRequest)
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome/120.0')
    expect(isGooglePayAvailable()).toBe(true)
    await expect(startGooglePay({ amount: 500, currency: 'usd', label: 'Demo' })).resolves.toContain('gpay')

    class RejectingRequest {
      canMakePayment = vi.fn().mockResolvedValue(false)
      show = vi.fn()
    }
    vi.stubGlobal('PaymentRequest', RejectingRequest)
    await expect(startGooglePay({ amount: 500, currency: 'usd', label: 'Demo' })).resolves.toBeNull()

    class ThrowingRequest {
      canMakePayment = vi.fn().mockRejectedValue(new Error('nope'))
      show = vi.fn()
    }
    vi.stubGlobal('PaymentRequest', ThrowingRequest)
    await expect(startGooglePay({ amount: 500, currency: 'usd', label: 'Demo' })).resolves.toBeNull()
  })
})
