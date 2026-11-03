/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./navigation', () => ({
  followRedirect: vi.fn(),
}))

import { followRedirect } from './navigation'
import { createNexus } from './loader'
import type { NexusElement } from './element'

function card(result: unknown): NexusElement {
  return { tokenize: vi.fn().mockResolvedValue(result), type: 'card', isMounted: () => true } as unknown as NexusElement
}

describe('confirm flows', () => {
  beforeEach(() => {
    vi.mocked(followRedirect).mockClear()
    vi.unstubAllGlobals()
  })

  it('confirmCardPayment returns the tokenize error without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const nexus = createNexus('pk_test_abc', { apiBase: 'https://api.test', nexusAccount: 'acct_1' })
    const result = await nexus.confirmCardPayment('cs_test', {
      payment_method: { card: card({ error: { code: 'incomplete', message: 'incomplete' } }) },
    })
    expect(result.error?.type).toBe('card_error')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('confirmCardPayment confirms and follows a 3DS redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payment_intent: { id: 'pi_1', status: 'requires_action' },
        next_action: { redirect_url: 'https://pay.test/3ds-mock?intent=pi_1' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const nexus = createNexus('pk_test_abc', { nexusAccount: 'acct_1' })
    const result = await nexus.confirmCardPayment('cs_test', {
      payment_method: { card: card({ token: 'tok_1' }), billing_details: { name: 'Ada' } },
      receipt_email: 'a@b.c',
      return_url: 'https://shop.test/return',
    })
    expect(result.paymentIntent?.status).toBe('requires_action')
    expect(followRedirect).toHaveBeenCalledWith('https://pay.test/3ds-mock?intent=pi_1')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Nexus-Account']).toBe('acct_1')
    expect(JSON.parse(init.body as string).payment_method_token).toBe('tok_1')
  })

  it('confirmCardPayment surfaces API and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { type: 'card_error', code: 'card_declined', message: 'declined', decline_code: 'generic_decline' } }),
    }))
    const nexus = createNexus('pk_test_abc')
    const declined = await nexus.confirmCardPayment('cs', { payment_method: { card: card({ paymentMethodId: 'pm_1' }) } })
    expect(declined.error?.decline_code).toBe('generic_decline')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const offline = await nexus.confirmCardPayment('cs', { payment_method: { card: card({ token: 'tok' }) } })
    expect(offline.error?.type).toBe('network_error')
  })

  it('confirmPayment validates inputs and confirms a mounted element', async () => {
    const nexus = createNexus('pk_test_abc')
    expect((await nexus.confirmPayment({})).error?.message).toMatch(/clientSecret/)
    expect((await nexus.confirmPayment({ clientSecret: 'cs' })).error?.message).toMatch(/elements or paymentMethodId/)

    const elements = nexus.elements()
    expect((await nexus.confirmPayment({ clientSecret: 'cs', elements })).error?.message).toMatch(/No mounted element/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ payment_intent: { id: 'pi_2', status: 'succeeded' } }),
    }))
    const mounted = card({ token: 'tok_mounted' })
    const internal = elements as unknown as { elements: Map<string, NexusElement> }
    internal.elements.set('el', mounted)
    const ok = await nexus.confirmPayment({
      clientSecret: 'cs',
      elements,
      confirmParams: { return_url: 'https://shop.test', receipt_email: 'a@b.c' },
    })
    expect(ok.paymentIntent?.status).toBe('succeeded')
  })

  it('confirmPayment keeps requires_action on the page when redirect is if_required', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payment_intent: { id: 'pi_3', status: 'requires_action' },
        next_action: { redirect_url: 'https://pay.test/3ds' },
      }),
    }))
    const nexus = createNexus('pk_test_abc')
    const result = await nexus.confirmPayment({
      clientSecret: 'cs',
      paymentMethodId: 'pm_saved',
      redirect: 'if_required',
    })
    expect(result.paymentIntent?.status).toBe('requires_action')
    expect(followRedirect).not.toHaveBeenCalled()
  })

  it('confirmPayment redirects when action is required', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'nope' } }),
    }))
    const nexus = createNexus('pk_test_abc')
    const failed = await nexus.confirmPayment({ clientSecret: 'cs', paymentMethodId: 'pm' })
    expect(failed.error?.message).toBe('nope')

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment_intent: { status: 'requires_action' }, next_action: { redirect_url: 'https://pay.test/go' } }),
      })
      .mockRejectedValueOnce(new Error('offline')))
    const redirected = await nexus.confirmPayment({ clientSecret: 'cs', paymentMethodId: 'pm' })
    expect(redirected.paymentIntent?.status).toBe('requires_action')
    expect(followRedirect).toHaveBeenCalledWith('https://pay.test/go')
    const offline = await nexus.confirmPayment({ clientSecret: 'cs', paymentMethodId: 'pm' })
    expect(offline.error?.type).toBe('network_error')
  })

  it('confirmSetup covers missing secret, tokenize errors, success, and failures', async () => {
    const nexus = createNexus('pk_test_abc', { apiBase: 'https://api.test' })
    const elements = nexus.elements({ clientSecret: 'seti_secret' })
    expect((await nexus.confirmSetup({ elements: nexus.elements(), confirmParams: { return_url: 'https://shop.test' } })).error?.message).toMatch(/clientSecret/)
    expect((await nexus.confirmSetup({ elements, confirmParams: { return_url: 'https://shop.test' } })).error?.message).toMatch(/No mounted/)

    const mounted = card({ error: { message: 'bad card', code: 'invalid' } })
    ;(elements as unknown as { elements: Map<string, NexusElement> }).elements.set('el', mounted)
    expect((await nexus.confirmSetup({ elements, confirmParams: { return_url: 'https://shop.test' } })).error?.type).toBe('card_error')

    mounted.tokenize = vi.fn().mockResolvedValue({ token: 'tok_setup' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ setup_intent: { id: 'seti_1', status: 'succeeded' } }),
    }))
    const ok = await nexus.confirmSetup({ elements, confirmParams: { return_url: 'https://shop.test' } })
    expect(ok.setupIntent?.id).toBe('seti_1')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'setup failed' } }) }))
    expect((await nexus.confirmSetup({ elements, confirmParams: { return_url: 'https://shop.test' } })).error?.message).toBe('setup failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect((await nexus.confirmSetup({ elements, confirmParams: { return_url: 'https://shop.test' } })).error?.type).toBe('network_error')
  })

  it('embedded checkout ignores foreign frames and accepts a same-frame completion', () => {
    const nexus = createNexus('pk_test_abc')
    const onComplete = vi.fn()
    const checkout = nexus.initEmbeddedCheckout({ clientSecret: 'cs_test', onComplete })
    const host = document.createElement('div')
    document.body.appendChild(host)
    checkout.mount(host)
    const iframe = host.querySelector('iframe')!
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'nexus:checkout-complete', session: { id: 'cs_1', status: 'complete' } },
      origin: 'https://evil.test',
      source: iframe.contentWindow,
    }))
    expect(onComplete).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'nexus:checkout-complete', session: { id: 'cs_1', status: 'complete' } },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }))
    expect(onComplete).toHaveBeenCalledWith({ id: 'cs_1', status: 'complete' })
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'nexus:checkout-redirect', url: 'https://shop.test/done' },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }))
    expect(followRedirect).toHaveBeenCalledWith('https://shop.test/done')
    checkout.unmount()
    expect(host.querySelector('iframe')).toBeNull()
    expect(() => checkout.mount('#missing')).toThrow(/not found/)
    checkout.destroy()
  })

  it('redirectToCheckout requires a url', () => {
    const nexus = createNexus('pk_test_abc')
    expect(() => nexus.redirectToCheckout({ id: 'cs', url: '' })).toThrow(/no URL/)
    nexus.redirectToCheckout({ id: 'cs', url: 'https://pay.test/checkout' })
    expect(followRedirect).toHaveBeenCalledWith('https://pay.test/checkout')
  })

  it('fetchUpdates asks order and cart elements to refresh', async () => {
    const nexus = createNexus('pk_test_abc')
    const elements = nexus.elements({ clientSecret: 'cs' })
    const order = {
      type: 'order',
      fetchUpdates: vi.fn().mockResolvedValue(undefined),
      isMounted: () => true,
      destroy: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      setAppearance: vi.fn(),
    }
    const cardEl = {
      type: 'card',
      fetchUpdates: vi.fn(),
      isMounted: () => false,
      destroy: vi.fn(),
      update: vi.fn(),
      setAppearance: vi.fn(),
    }
    const map = (elements as unknown as { elements: Map<string, { destroy: () => void }> }).elements
    map.set('order', order)
    map.set('card', cardEl)
    await elements.fetchUpdates()
    expect(order.fetchUpdates).toHaveBeenCalled()
    expect(cardEl.fetchUpdates).not.toHaveBeenCalled()
    elements.update({ locale: 'fr', appearance: { theme: 'flat' } })
    elements.destroyAll()
    expect(order.destroy).toHaveBeenCalled()
  })

  it('loadNexus returns a local instance unless a script URL is requested', async () => {
    const { loadNexus } = await import('./loader')
    const local = await loadNexus('pk_test_local')
    expect(local.publishableKey).toBe('pk_test_local')
  })
})
