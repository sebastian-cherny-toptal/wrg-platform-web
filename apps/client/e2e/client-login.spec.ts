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

test('promotional user can open the employee feedback dashboard reports', async ({ page }) => {
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
  await page.getByRole('link', { name: 'Click here to see your survey average' }).first().click()
  await expect(page.getByRole('heading', { name: 'Employee Feedback Data Dashboard' })).toBeVisible()
  const reportLinks = page.getByRole('link', { name: 'View Report' })
  await expect(reportLinks).toHaveCount(4)
  await expect(reportLinks.nth(0)).toHaveAttribute('href', '/employee-response-breakdown')
  await expect(reportLinks.nth(1)).toHaveAttribute('href', '/employee-verbatims')
  await expect(reportLinks.nth(2)).toHaveAttribute('href', '/workforce-benchmark-comparisons')
  await expect(reportLinks.nth(3)).toHaveAttribute('href', '/benefits-and-best-practices')

  await reportLinks.first().click()
  await expect(page).toHaveURL(/\/employee-response-breakdown$/u)
  await expect(page).not.toHaveURL(/\/forbidden$/u)

  await page.getByLabel('Primary navigation').getByText('My Reports', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Employee Response Breakdown' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Reports Store' })).toBeVisible()
})
