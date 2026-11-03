/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { loadNexus, loadScript } from './loader'

describe('loadNexus', () => {
  it('constructs from the already loaded module when no CDN script is requested', async () => {
    const nexus = await loadNexus('pk_test_from_package', { apiBase: 'https://api.test', nexusAccount: 'acct' })
    expect(nexus.publishableKey).toBe('pk_test_from_package')
    expect(nexus.elements().getClientSecret()).toBeUndefined()
  })

  it('uses the global factory after the CDN script loads', async () => {
    const created = { publishableKey: 'pk_test_global' }
    ;(window as unknown as { Nexus: { createNexus: () => unknown } }).Nexus = {
      createNexus: () => created,
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.test/nexus.js'
    document.head.appendChild(script)
    const pending = loadNexus('pk_test_global', { scriptUrl: 'https://cdn.test/nexus.js' })
    script.dispatchEvent(new Event('load'))
    await expect(pending).resolves.toBe(created)
  })
})

describe('loadScript', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    delete (window as unknown as Record<string, unknown>).Nexus
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as Record<string, unknown>).Nexus
    document.head.querySelectorAll('script').forEach((s) => s.remove())
  })

  it('resolves immediately when window.Nexus already exists', async () => {
    (window as unknown as Record<string, unknown>).Nexus = {}
    await loadScript()
    expect(document.head.querySelectorAll('script')).toHaveLength(0)
  })

  it('attaches to an existing script tag instead of creating a new one', async () => {
    const existing = document.createElement('script')
    existing.src = 'https://js.nexuspay.com/v1/nexus.js'
    document.head.appendChild(existing)

    const promise = loadScript()
    existing.dispatchEvent(new Event('load'))
    await promise

    expect(document.head.querySelectorAll('script')).toHaveLength(1)
    expect(document.head.querySelector('script')).toBe(existing)
  })

  it('rejects when existing script tag fails to load', async () => {
    const existing = document.createElement('script')
    existing.src = 'https://js.nexuspay.com/v1/nexus.js'
    document.head.appendChild(existing)

    const promise = loadScript()
    existing.dispatchEvent(new Event('error'))
    await expect(promise).rejects.toThrow(/failed to load/i)
  })

  it('injects a script tag with the default CDN URL', async () => {
    const promise = loadScript()
    const script = document.head.querySelector('script')!
    expect(script.src).toBe('https://js.nexuspay.com/v1/nexus.js')
    expect(script.async).toBe(true)
    script.dispatchEvent(new Event('load'))
    await promise
  })

  it('uses a custom URL when provided', async () => {
    const customUrl = 'https://cdn.example.com/nexus.js'
    const promise = loadScript({ url: customUrl })
    const script = document.head.querySelector('script')!
    expect(script.src).toBe(customUrl)
    script.dispatchEvent(new Event('load'))
    await promise
  })

  it('sets SRI integrity and crossOrigin when integrity is provided', async () => {
    const integrity = 'sha384-abcdef1234567890'
    const promise = loadScript({ integrity })
    const script = document.head.querySelector('script')!
    expect(script.integrity).toBe(integrity)
    expect(script.crossOrigin).toBe('anonymous')
    script.dispatchEvent(new Event('load'))
    await promise
  })

  it('does not set integrity when not provided', async () => {
    const promise = loadScript()
    const script = document.head.querySelector('script')!
    expect(script.integrity).toBeFalsy()
    script.dispatchEvent(new Event('load'))
    await promise
  })

  it('retries on failure with exponential backoff', async () => {
    const promise = loadScript({ retries: 3 })

    const script1 = document.head.querySelector('script')!
    script1.dispatchEvent(new Event('error'))
    expect(document.head.querySelectorAll('script')).toHaveLength(0)

    vi.advanceTimersByTime(1000)
    const script2 = document.head.querySelector('script')!
    expect(script2).toBeTruthy()
    script2.dispatchEvent(new Event('error'))

    vi.advanceTimersByTime(2000)
    const script3 = document.head.querySelector('script')!
    expect(script3).toBeTruthy()
    script3.dispatchEvent(new Event('load'))

    await promise
  })

  it('rejects after exhausting all retries', async () => {
    const promise = loadScript({ retries: 2 })

    const script1 = document.head.querySelector('script')!
    script1.dispatchEvent(new Event('error'))

    vi.advanceTimersByTime(1000)
    const script2 = document.head.querySelector('script')!
    script2.dispatchEvent(new Event('error'))

    vi.advanceTimersByTime(2000)

    await expect(promise).rejects.toThrow(/after 2 attempts/)
    expect(document.head.querySelectorAll('script')).toHaveLength(0)
  })

  it('removes failed script tags before retrying', async () => {
    const promise = loadScript({ retries: 3 })

    const script1 = document.head.querySelector('script')!
    expect(script1.parentNode).toBe(document.head)
    script1.dispatchEvent(new Event('error'))
    expect(document.head.querySelectorAll('script')).toHaveLength(0)

    vi.advanceTimersByTime(1000)
    const script2 = document.head.querySelector('script')!
    script2.dispatchEvent(new Event('load'))
    await promise
  })

  it('deduplicates concurrent calls for the same URL', async () => {
    const p1 = loadScript()
    const script = document.head.querySelector('script')!

    const p2 = loadScript()

    script.dispatchEvent(new Event('load'))
    await p1
    await p2

    expect(document.head.querySelectorAll('script')).toHaveLength(1)
  })
})
