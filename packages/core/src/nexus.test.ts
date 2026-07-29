import { describe, expect, it, vi } from 'vitest'
import { createNexus } from './loader'
import { NexusElements } from './elements'

describe('createNexus', () => {
  it('accepts a test publishable key', () => {
    const nexus = createNexus('pk_test_abc123')
    expect(nexus.publishableKey).toBe('pk_test_abc123')
  })

  it('accepts a live publishable key', () => {
    const nexus = createNexus('pk_live_abc123')
    expect(nexus.publishableKey).toBe('pk_live_abc123')
  })

  it.each(['sk_test_abc123', 'pk_abc123', '', 'PK_TEST_ABC'])('rejects invalid key %j', (key) => {
    expect(() => createNexus(key)).toThrow(/Invalid publishable key/)
  })

  it('creates an elements instance', () => {
    const nexus = createNexus('pk_test_abc123')
    const elements = nexus.elements()
    expect(elements).toBeInstanceOf(NexusElements)
  })
})

describe('NexusElements', () => {
  it('creates elements with unique ids', () => {
    const nexus = createNexus('pk_test_abc123')
    const elements = nexus.elements()
    const card = elements.create('card')
    const iban = elements.create('iban')
    expect(card.id).not.toBe(iban.id)
    expect(elements.getElement(card.id)).toBe(card)
  })

  it('returns undefined for unknown element ids', () => {
    const nexus = createNexus('pk_test_abc123')
    const elements = nexus.elements()
    expect(elements.getElement('nexus_el_missing')).toBeUndefined()
  })
})

describe('confirmPayment (paymentMethodId direct path)', () => {
  it('confirms with a wallet token without mounted elements', async () => {
    const nexus = createNexus('pk_test_abc123')
    const requests: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(init.body as string) })
      return {
        ok: true,
        json: async () => ({ payment_intent: { id: 'pi_test_1', status: 'succeeded' } }),
      }
    })

    try {
      const result = await nexus.confirmPayment({
        clientSecret: 'pi_test_1_secret_x',
        paymentMethodId: 'pm_test_wallet',
      })

      expect(result.error).toBeUndefined()
      expect(result.paymentIntent?.status).toBe('succeeded')
      expect(requests).toHaveLength(1)
      const request = requests[0]!
      expect(request.url).toContain('/v1/payment_intents/confirm')
      expect(request.body.payment_method_token).toBe('pm_test_wallet')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('errors when neither elements nor paymentMethodId is provided', async () => {
    const nexus = createNexus('pk_test_abc123')
    const result = await nexus.confirmPayment({ clientSecret: 'pi_test_1_secret_x' })
    expect(result.error?.message).toMatch(/elements or paymentMethodId/)
  })
})
