import { expect, test } from '@playwright/test'

test('client can enter the fixture reporting workspace', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('demo-client')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  await expect(page.getByRole('heading', { name: /Welcome, Demo Client/ })).toBeVisible()
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
  }
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toContainText('Workforce Feedback')
})
