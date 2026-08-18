import { expect, test } from '@playwright/test'
import { clientFixtureUsername, installClientApiFixture } from './support/client-api-fixture'

test('client can enter the fixture reporting workspace', async ({ page }) => {
  await installClientApiFixture(page, { dashboard: true })
  await page.goto('/login')
  await page.getByLabel('Username').fill(clientFixtureUsername)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  await expect(page.getByRole('heading', { name: /Welcome, Demo Client/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workforce Feedback Results' })).toBeVisible()
})

test('promotional user sees locked results and no report links', async ({ page }) => {
  await installClientApiFixture(page, { dashboard: true, role: 'Promotional' })
  await page.goto('/login')
  await page.getByLabel('Username').fill(clientFixtureUsername)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  await expect(page.getByRole('dialog', { name: 'The results are in!' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Click here to see your survey average' })).toHaveCount(3)
  await page.getByText('My Reports', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Employee Response Breakdown' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Reports Store' })).toBeVisible()
})
