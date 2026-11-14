import { expect, test } from '@playwright/test'

/** Batch-1 flows not covered by card/checkout server specs (billing + inline Link). */

test('billing flow saves a card without claiming a subscription was created', async ({ page }) => {
  await page.goto('/billing')
  await page.getByRole('button', { name: '继续支付' }).click()
  const frame = page.frameLocator("iframe[title='Nexus payment element']")
  await frame.locator('input.nexus-number').pressSequentially('4242424242424242', { delay: 15 })
  await frame.locator('input.nexus-expiry').pressSequentially('1228', { delay: 15 })
  await frame.locator('input.nexus-cvc').pressSequentially('123', { delay: 15 })
  await page.locator('.btn-pay').click()
  await expect(page.locator('.success-section')).toContainText('支付方式已保存')
  await expect(page.locator('.success-section')).not.toContainText('订阅成功')
})

test('payment element shows the sandbox Link email row', async ({ page }) => {
  await page.goto('/payment-element?link=1')
  const frame = page.frameLocator("iframe[title='Nexus payment element']")
  await expect(frame.locator('.nexus-link-sandbox-badge')).toContainText(/sandbox/i)
  await frame.locator('#nexus-link-email').fill('link.demo@nexus.test')
  await frame.getByRole('button', { name: /sandbox code/i }).click()
  const otp = frame.locator('.nexus-payment-link-otp')
  const code = '123456'
  for (let i = 0; i < 6; i++) {
    await otp.nth(i).fill(code[i]!)
  }
  await frame.getByRole('button', { name: /Verify/i }).click()
  await expect(frame.locator('.nexus-link-verified')).toBeVisible()
})