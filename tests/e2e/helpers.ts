import { expect, type FrameLocator, type Page } from '@playwright/test'

export function cardFrame(page: Page, title = 'Nexus card element'): FrameLocator {
  return page.frameLocator(`iframe[title="${title}"]`)
}

export async function fillCard(page: Page, options: { number?: string; postal?: boolean; title?: string } = {}) {
  const frame = cardFrame(page, options.title ?? 'Nexus card element')
  const number = frame.locator('input.nexus-number')
  await number.waitFor({ state: 'visible' })
  await number.click()
  await number.pressSequentially(options.number ?? '4242424242424242', { delay: 15 })
  await frame.locator('input.nexus-expiry').click()
  await frame.locator('input.nexus-expiry').pressSequentially('1228', { delay: 15 })
  await frame.locator('input.nexus-cvc').click()
  await frame.locator('input.nexus-cvc').pressSequentially('123', { delay: 15 })
  if (options.postal !== false) {
    const postal = frame.locator('input.nexus-postal')
    if (await postal.count()) {
      await postal.click()
      await postal.pressSequentially('10001', { delay: 15 })
    }
  }
  return frame
}

export async function pay(page: Page) {
  const button = page.locator('button.btn-pay')
  await expect(button).toBeEnabled()
  await button.click()
  return button
}

export async function fillHostedCard(frame: FrameLocator, number = '4242424242424242') {
  await frame.locator('#cs-number').fill(number)
  await frame.locator('#cs-expiry').fill('12/28')
  await frame.locator('#cs-cvc').fill('123')
  await frame.locator('#cs-pay').click()
}
