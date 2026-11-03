import { expect, test } from '@playwright/test'

test('address element validates postal codes by country', async ({ page }) => {
  await page.goto('/address')
  const frame = page.frameLocator("iframe[title='Nexus address element']")
  const state = frame.locator('.nexus-state, select, input').first()
  await state.waitFor({ state: 'visible' })
  const tag = await frame.locator('[name="state"], select').first().evaluate((el) => el.tagName).catch(async () => {
    return frame.locator('select').first().evaluate((el) => el.tagName)
  })
  expect(tag).toBe('SELECT')
  await frame.locator('input.nexus-postal, input[autocomplete="postal-code"]').fill('12')
  await frame.locator('input.nexus-postal, input[autocomplete="postal-code"]').blur()
  await expect(page.locator('.result-box')).toContainText('valid: false')
  await frame.locator('input.nexus-postal, input[autocomplete="postal-code"]').fill('10001')
  await frame.locator('input.nexus-postal, input[autocomplete="postal-code"]').blur()
  await expect(page.locator('.result-box')).toContainText('10001')
})

test('afterpay messaging switches currency', async ({ page }) => {
  await page.goto('/afterpay-clearpay')
  const frame = page.frameLocator("iframe[title='Nexus afterpayClearpay element']")
  await expect(frame.locator('.nexus-apc-message')).toContainText('4 期免息')
  await expect(frame.locator('.nexus-apc-brand')).toContainText('Afterpay')
  await page.getByRole('button', { name: 'GBP' }).click()
  await expect(frame.locator('.nexus-apc-message')).toContainText('£')
})

test('appearance playground applies a theme and clears the field', async ({ page }) => {
  await page.goto('/appearance')
  const frame = page.frameLocator("iframe[title='Nexus card element']")
  await frame.locator('input.nexus-number').waitFor({ state: 'visible' })
  await page.locator('.chip', { hasText: 'night' }).click()
  await expect.poll(() => frame.locator('.nexus-card-element').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(48, 49, 61)')
  await frame.locator('input.nexus-number').pressSequentially('4242', { delay: 10 })
  await page.getByRole('button', { name: 'clear()' }).click()
  await expect(frame.locator('input.nexus-number')).toHaveValue('')
})

test('bank elements complete without returning a full IBAN', async ({ page }) => {
  await page.goto('/bank-transfer')
  const ideal = page.frameLocator("iframe[title='Nexus idealBank element']")
  await ideal.locator('.nexus-bank-item').first().click()
  await expect(page.locator('.result-box')).toContainText('complete: true')

  await page.locator('.tab-btn', { hasText: 'IBAN' }).click()
  const iban = page.frameLocator("iframe[title='Nexus iban element']")
  await iban.locator('input').fill('DE89370400440532013000')
  await expect(page.locator('.result-box')).toContainText('complete: true')
  await expect(page.locator('.value-dump')).not.toContainText('DE89370400440532013000')
})

test('billing flow subscribes with a card', async ({ page }) => {
  await page.goto('/billing')
  await expect(page.locator('.plan-card')).toContainText('Nexus Pro')
  await page.getByRole('button', { name: /年/ }).click()
  await page.getByRole('button', { name: '继续支付' }).click()
  const frame = page.frameLocator("iframe[title='Nexus payment element']")
  await frame.locator('input.nexus-number').pressSequentially('4242424242424242', { delay: 15 })
  await frame.locator('input.nexus-expiry').pressSequentially('1228', { delay: 15 })
  await frame.locator('input.nexus-cvc').pressSequentially('123', { delay: 15 })
  await expect(page.locator('.btn-pay')).toBeEnabled()
  await page.locator('.btn-pay').click()
  await expect(page.locator('.success-section')).toContainText('订阅成功')
})

test('cart updates quantity, shipping, and promo state', async ({ page }) => {
  await page.goto('/cart')
  const frame = page.frameLocator("iframe[title='Nexus cart element']")
  await expect(frame.locator('.nexus-cart-item')).toHaveCount(3)
  await frame.locator('.nexus-cart-qty-btn[aria-label="增加数量"]').first().click()
  await expect(frame.locator('.nexus-cart-qty-value').first()).toHaveText('2')
  await frame.locator('.nexus-cart-promo-field').fill('NEXUS10')
  await frame.locator('.nexus-cart-promo-btn').click()
  await expect(frame.locator('.nexus-cart-promo-applied')).toBeVisible()
})

test('express checkout confirms a wallet', async ({ page }) => {
  await page.goto('/express-checkout')
  const frame = page.frameLocator("iframe[title='Nexus expressCheckout element']")
  await expect(frame.locator('.nexus-wallet-btn')).toHaveCount(4)
  await frame.locator('[data-wallet="applePay"]').click()
  await expect(page.locator('.result-box--success, .result-box')).toBeVisible()
})

test('payment element filters methods by currency', async ({ page }) => {
  await page.goto('/payment-element')
  const frame = page.frameLocator("iframe[title='Nexus payment element']")
  await expect(frame.locator('.nexus-tab')).toHaveCount(1)
  await page.locator('.chip', { hasText: 'EUR' }).click()
  await expect(frame.locator('.nexus-tab')).toHaveCount(2)
  await expect(frame.locator('.nexus-checkbox')).toBeVisible()
})

test('wallet button previews and link authentication', async ({ page }) => {
  await page.goto('/wallet-button')
  const frame = page.locator('iframe[title="Nexus walletButton element"]').first().contentFrame()
  await expect(frame.locator('.nexus-wb-text')).toContainText('Apple Pay')
  await expect(page.locator('.wallet-preview')).toHaveCount(4)

  await page.goto('/link-authentication')
  const link = page.frameLocator("iframe[title='Nexus linkAuthentication element']")
  await link.locator('.nexus-link-phone').fill('5551234567')
  await link.locator('.nexus-link-send-btn').click()
  await expect(link.locator('.nexus-otp-input').first()).toBeVisible()
})

test('order and payment messaging render their summaries', async ({ page }) => {
  await page.goto('/order')
  const order = page.frameLocator("iframe[title='Nexus order element']")
  await expect(order.locator('.nexus-order-status')).toContainText('处理中')
  await expect(order.locator('.nexus-order-item')).toHaveCount(2)

  await page.goto('/payment-messaging')
  const messaging = page.frameLocator("iframe[title='Nexus paymentMethodMessaging element']")
  await expect(messaging.locator('.nexus-pmm-message').first()).toContainText('Afterpay')
})
