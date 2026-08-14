import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { installClientApiFixture } from './support/client-api-fixture'

async function logIn(page: Page) {
  await installClientApiFixture(page, { dashboard: true })
  await page.goto('/login')
  await page.getByLabel('Username').fill('demo-client')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()
  await expect(page.getByRole('heading', { name: /Welcome, Demo Client/u })).toBeVisible()
}

async function downloadChart(page: Page, format: 'PNG' | 'SVG' | 'JPG') {
  await page.getByRole('button', { name: 'Download Average Positive and Average Negative Response' }).click()
  await expect(page.getByRole('menuitem', { name: 'Download as PNG' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Download as SVG' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Download as JPG' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: `Download as ${format}` }).click()
  return downloadPromise
}

async function downloadPath(download: Awaited<ReturnType<typeof downloadChart>>) {
  const value = await download.path()
  expect(value).not.toBeNull()
  if (!value) throw new Error('Downloaded file is unavailable')
  return value
}

test('chart arrows download PNG, SVG, and JPG images', async ({ page }) => {
  await logIn(page)

  const png = await downloadChart(page, 'PNG')
  expect(png.suggestedFilename()).toBe('Average Positive and Average Negative Response.png')
  expect((await readFile(await downloadPath(png))).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  )

  const svg = await downloadChart(page, 'SVG')
  expect(svg.suggestedFilename()).toBe('Average Positive and Average Negative Response.svg')
  expect((await readFile(await downloadPath(svg), 'utf8')).trimStart()).toMatch(/^<svg\b/u)

  const jpg = await downloadChart(page, 'JPG')
  expect(jpg.suggestedFilename()).toBe('Average Positive and Average Negative Response.jpg')
  expect((await readFile(await downloadPath(jpg))).subarray(0, 2)).toEqual(Buffer.from([255, 216]))
})
