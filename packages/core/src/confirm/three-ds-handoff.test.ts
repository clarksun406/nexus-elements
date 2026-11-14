/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearThreeDsHandoff,
  readThreeDsHandoff,
  resolveThreeDsReturn,
  storeThreeDsHandoff,
} from './three-ds-handoff'

describe('three-ds handoff', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    window.history.replaceState(null, '', '/card-combined')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearThreeDsHandoff()
  })

  it('stores and reads a pending handoff', () => {
    storeThreeDsHandoff({
      intentId: 'pi_test_1',
      clientSecret: 'pi_test_1_secret',
      startedAt: Date.now(),
      returnUrl: '/card-combined',
    })
    expect(readThreeDsHandoff()?.intentId).toBe('pi_test_1')
  })

  it('maps return URL params to approved outcomes', async () => {
    window.history.replaceState(null, '', '/card-combined?status=approved&intent=pi_ok')
    storeThreeDsHandoff({
      intentId: 'pi_ok',
      clientSecret: 'sec',
      startedAt: Date.now(),
      returnUrl: '/card-combined',
    })
    const resolution = await resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    expect(resolution.kind).toBe('approved')
    expect(readThreeDsHandoff()).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('cancels a stale challenge when the shopper returns without a result', async () => {
    storeThreeDsHandoff({
      intentId: 'pi_pending',
      clientSecret: 'sec',
      startedAt: Date.now(),
      returnUrl: '/card-combined',
    })
    const resolution = await resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    expect(resolution.kind).toBe('abandoned')
    expect(fetch).toHaveBeenCalledWith(
      '/v1/3ds/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ intent: 'pi_pending', status: 'cancelled' }),
      }),
    )
  })

  it('surfaces explicit cancelled status from the challenge page', async () => {
    window.history.replaceState(null, '', '/card-combined?status=cancelled&intent=pi_cancel')
    const resolution = await resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    expect(resolution.kind).toBe('cancelled')
    expect(resolution.userMessage).toContain('取消')
  })
})