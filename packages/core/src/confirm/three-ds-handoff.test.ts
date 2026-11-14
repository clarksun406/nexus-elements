/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearThreeDsHandoff,
  readThreeDsHandoff,
  resetThreeDsResolveState,
  resolveThreeDsReturn,
  storeThreeDsHandoff,
} from './three-ds-handoff'

describe('three-ds handoff', () => {
  beforeEach(() => {
    sessionStorage.clear()
    resetThreeDsResolveState()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    window.history.replaceState(null, '', '/card-combined')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetThreeDsResolveState()
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

  it('ignores corrupted handoff JSON', () => {
    sessionStorage.setItem('nexus:3ds-handoff:v1', '{not-json')
    expect(readThreeDsHandoff()).toBeNull()
  })

  it('maps return URL params to approved outcomes and strips query', async () => {
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

  it('maps challenge failure to a recoverable message', async () => {
    window.history.replaceState(null, '', '/card-combined?status=failed&intent=pi_fail')
    const resolution = await resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    expect(resolution.kind).toBe('failed')
    expect(resolution.userMessage).toContain('失败')
  })

  it('times out an expired handoff', async () => {
    storeThreeDsHandoff({
      intentId: 'pi_old',
      clientSecret: 'sec',
      startedAt: Date.now() - 60_000,
      returnUrl: '/card-combined',
    })
    const resolution = await resolveThreeDsReturn({
      apiBase: '',
      publishableKey: 'pk_test_x',
      abandonAfterMs: 1,
    })
    expect(resolution.kind).toBe('timeout')
    expect(fetch).toHaveBeenCalledTimes(1)
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

  it('does not double-post 3DS completion when resolve runs concurrently', async () => {
    storeThreeDsHandoff({
      intentId: 'pi_once',
      clientSecret: 'sec',
      startedAt: Date.now(),
      returnUrl: '/card-combined',
    })
    vi.mocked(fetch).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
    )
    const first = resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    const second = resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    const [a, b] = await Promise.all([first, second])
    expect(a).toEqual(b)
    expect(a.kind).toBe('abandoned')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('ignores a mismatched intent id in the URL when handoff points elsewhere', async () => {
    storeThreeDsHandoff({
      intentId: 'pi_real',
      clientSecret: 'sec',
      startedAt: Date.now(),
      returnUrl: '/card-combined',
    })
    window.history.replaceState(null, '', '/card-combined?status=approved&intent=pi_foreign')
    const resolution = await resolveThreeDsReturn({ apiBase: '', publishableKey: 'pk_test_x' })
    expect(resolution.kind).toBe('approved')
    expect(resolution.intentId).toBe('pi_foreign')
  })

  it('clearThreeDsHandoff removes storage keys', () => {
    storeThreeDsHandoff({
      intentId: 'pi_x',
      clientSecret: 's',
      startedAt: Date.now(),
      returnUrl: '/',
    })
    sessionStorage.setItem('nexus:3ds-resolve-lock:v1', '1')
    clearThreeDsHandoff()
    expect(sessionStorage.getItem('nexus:3ds-handoff:v1')).toBeNull()
    expect(sessionStorage.getItem('nexus:3ds-resolve-lock:v1')).toBeNull()
  })
})