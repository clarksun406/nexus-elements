import { expect, test } from '@playwright/test'
import { fillCard, pay } from './helpers'

test('combined card pays, themes, and element methods', async ({ page }) => {
  await page.goto('/card-combined')
  const frame = await fillCard(page)
  await expect(frame.locator('input.nexus-number')).toHaveValue('4242 4242 4242 4242')
  await pay(page)
  await expect(page.locator('.result-box--success')).toContainText('支付成功')

  await page.locator('.theme-btn', { hasText: 'night' }).click()
  const card = frame.locator('.nexus-card-element')
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(48, 49, 61)')
  await page.locator('.theme-btn', { hasText: 'flat' }).click()
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('2px')

  await page.locator("[data-toggle='hidePostalCode']").check()
  await expect(frame.locator('input.nexus-postal')).toHaveCount(0)
  await page.locator("[data-toggle='hidePostalCode']").uncheck()
  await expect(frame.locator('input.nexus-postal')).toHaveCount(1)

  await page.locator("[data-toggle='disabled']").check()
  await expect(frame.locator('input.nexus-number')).toBeDisabled()
  await page.locator("[data-toggle='disabled']").uncheck()
  await expect(frame.locator('input.nexus-number')).toBeEnabled()

  await frame.locator('input.nexus-number').click()
  await frame.locator('input.nexus-number').pressSequentially('4242424242424242', { delay: 10 })
  await page.locator(".method-btn[data-method='blur']").click()
  await page.locator(".method-btn[data-method='focus']").click()
  await page.locator(".method-btn[data-method='clear']").click()
  await expect(frame.locator('input.nexus-number')).toHaveValue('')
  const events = await page.locator('.event-type').allInnerTexts()
  expect(events.some((entry) => entry.includes('focus'))).toBe(true)
  expect(events.some((entry) => entry.includes('blur'))).toBe(true)
})

test('split card tokenizes without exposing the PAN to the parent', async ({ page }) => {
  const leaked: string[] = []
  page.on('console', (msg) => leaked.push(msg.text()))
  await page.exposeFunction('__nexusLeak', (payload: string) => leaked.push(payload))
  await page.addInitScript(() => {
    window.addEventListener('message', (event) => {
      const text = JSON.stringify(event.data ?? {})
      if (text.includes('4242424242424242')) {
        void (window as unknown as { __nexusLeak: (value: string) => void }).__nexusLeak(text)
      }
    })
  })
  await page.goto('/card-split')
  const number = page.frameLocator("iframe[title='Nexus cardNumber element']")
  const expiry = page.frameLocator("iframe[title='Nexus cardExpiry element']")
  const cvc = page.frameLocator("iframe[title='Nexus cardCvc element']")
  await number.locator('input.nexus-input').pressSequentially('4242424242424242', { delay: 15 })
  await expiry.locator('input.nexus-input').pressSequentially('1228', { delay: 15 })
  await cvc.locator('input.nexus-input').pressSequentially('123', { delay: 15 })
  await pay(page)
  await expect(page.locator('.result-box--success')).toContainText('支付成功')
  await expect(page.locator('.result-box--success')).toContainText('visa')
  expect(leaked.join('\n')).not.toContain('4242424242424242')
})

test('3DS challenge returns to a succeeded payment', async ({ page }) => {
  await page.goto('/card-combined')
  await fillCard(page, { number: '4000000000003220' })
  await pay(page)
  await page.waitForURL('**/3ds-mock**')
  await page.locator('button.approve').click()
  await page.waitForURL((url) => url.search.includes('status=approved'))
  await expect(page.locator('.result-box--success')).toContainText('支付成功')
  await expect(page.locator('.result-box--success')).toContainText('3DS 验证通过')
})

test('setup intent saves a card and surfaces a decline', async ({ page }) => {
  await page.goto('/setup-intent')
  await fillCard(page)
  await pay(page)
  await expect(page.locator('.result-box--success')).toContainText('保存成功')
  await expect(page.locator('.result-box--success')).toContainText('seti_test_')

  await page.reload()
  await fillCard(page, { number: '4000000000000002' })
  await pay(page)
  await expect(page.locator('.result-box--error')).toBeVisible()
})
