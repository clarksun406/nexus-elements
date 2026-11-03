import { expect, test } from '@playwright/test'
import { fillCard } from './helpers'

test('forged and cross-origin postMessage cannot read or replace card data', async ({ page }) => {
  const leaks: string[] = []
  await page.exposeFunction('__nexusLeak', (payload: string) => leaks.push(payload))
  await page.addInitScript(() => {
    window.addEventListener('message', (event) => {
      const text = JSON.stringify(event.data ?? {})
      if (/\d{13,19}/.test(text) && text.includes('4242')) {
        void (window as unknown as { __nexusLeak: (value: string) => void }).__nexusLeak(text)
      }
    })
  })

  await page.goto('/card-combined')
  const frame = await fillCard(page)
  await expect(frame.locator('input.nexus-number')).toHaveValue('4242 4242 4242 4242')

  const forged = await frame.locator('input.nexus-number').evaluate((input) => {
    const elementId = new URL(window.location.href).searchParams.get('elementId') ?? ''
    const attack = {
      version: 1,
      id: 'forged',
      type: 'nexus:collect-data',
      elementId,
      payload: {},
      signature: `sig_${'0'.repeat(64)}`,
      timestamp: Date.now(),
    }
    window.dispatchEvent(new MessageEvent('message', {
      data: attack,
      origin: 'https://evil.example',
      source: window.parent,
    }))
    window.parent.postMessage(attack, '*')
    return (input as HTMLInputElement).value
  })
  expect(forged).toBe('4242 4242 4242 4242')
  await page.waitForTimeout(300)
  expect(leaks).toEqual([])

  await page.evaluate(() => {
    const iframe = document.querySelector('iframe')
    iframe?.contentWindow?.postMessage({
      version: 1,
      id: 'parent-forged',
      type: 'nexus:clear',
      elementId: 'nexus_el_1',
      payload: {},
      signature: 'sig_deadbeef',
      timestamp: Date.now(),
    }, '*')
  })
  await page.waitForTimeout(200)
  await expect(frame.locator('input.nexus-number')).toHaveValue('4242 4242 4242 4242')
})
