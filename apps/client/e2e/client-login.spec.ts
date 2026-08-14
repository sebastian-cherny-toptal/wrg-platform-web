import { expect, test } from '@playwright/test'
import { installClientApiFixture } from './support/client-api-fixture'

test('client can enter the fixture reporting workspace', async ({ page }) => {
  await installClientApiFixture(page, { dashboard: true })
  await page.goto('/login')
  await page.getByLabel('Username').fill('demo-client')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  await expect(page.getByRole('heading', { name: /Welcome, Demo Client/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workforce Feedback Results' })).toBeVisible()
})
