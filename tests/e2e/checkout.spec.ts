import { expect, test } from '@playwright/test'
import { fillHostedCard } from './helpers'

test('embedded checkout completes inside the hosted frame', async ({ page }) => {
  await page.goto('/embedded-checkout')
  await expect(page.locator('.session-id')).toContainText('cs_test_')
  const frame = page.frameLocator("iframe[title='Nexus embedded checkout']")
  await expect(frame.locator('#cs-total')).toContainText('¥129.00')
  await expect(frame.locator('.line-item')).toHaveCount(2)

  await fillHostedCard(frame, '4000000000000002')
  await expect(frame.locator('#cs-error')).toContainText('拒绝')

  await frame.locator('#cs-number').fill('4242424242424242')
  await frame.locator('#cs-pay').click()
  await expect(frame.locator('#cs-success')).toContainText('支付成功')
  const result = page.locator('.result-box--success')
  await expect(result).toContainText('结账完成')
  await expect(result).toContainText('cs_test_')
  await expect(result).toContainText('pi_test_')
})

test('redirect checkout returns to the success page', async ({ page }) => {
  await page.goto('/redirect-checkout')
  await expect(page.locator('.order-summary')).toContainText('Nexus Pro 年度订阅')
  await expect(page.locator('.order-summary')).toContainText('¥129.00')
  await page.getByRole('button', { name: '前往支付' }).click()
  await expect(page.locator('#cs-total')).toContainText('¥129.00')
  await page.locator('#cs-number').fill('4242424242424242')
  await page.locator('#cs-expiry').fill('12/28')
  await page.locator('#cs-cvc').fill('123')
  await page.locator('#cs-pay').click()
  await expect(page.locator('.result-box--success')).toContainText('cs_test_')
  await expect(page.locator('.result-box--success')).toContainText('complete')
})
