import { expect, test } from '@playwright/test'
import { clientFixtureUsername, installClientApiFixture } from './support/client-api-fixture'

const product = {
  id: 'report-standard-package',
  name: 'Standard Report Package',
  description: 'Employee feedback reports',
  priceCents: 42500,
  available: true,
  purchaseMode: 'checkout',
  fulfillment: 'instant',
  requiresStandardPackage: false,
  priceAvailable: true,
  owned: false,
  standardPackageOwned: false,
  purchasable: true,
  deliveryMessage: 'Immediate access',
}

test('store actions use the dark violet treatment through checkout', async ({ page }, testInfo) => {
  await installClientApiFixture(page, { dashboard: true, role: 'Promotional', reportAccess: {} })
  await page.route('**/reports/catalog?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([product]) })
  })
  await page.route('**/client/fetchSurveyFilter?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, message: 'success', data: [] }) })
  })
  await page.route('**/user/report-statuses', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  })
  await page.route('**/payment/stripePaymentIntent?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ client_secret: 'pi_test_secret' }) })
  })

  await page.goto('/login')
  await page.getByLabel('Username').fill(clientFixtureUsername)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill('client@example.invalid')
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  const screenshot = async (name: string) => {
    if (process.env.STORE_COLOR_CAPTURE) {
      await page.screenshot({ path: `${process.env.STORE_COLOR_CAPTURE}/${testInfo.project.name}-${name}.png`, fullPage: true })
    }
  }
  const check = async (locator: ReturnType<typeof page.getByRole>, className: string) => {
    await expect(locator).toHaveClass(new RegExp(className))
  }
  const backgroundOf = (locator: ReturnType<typeof page.getByRole>) =>
    locator.evaluate((element) => (globalThis as unknown as {
      getComputedStyle: (target: unknown) => { backgroundColor: string }
    }).getComputedStyle(element).backgroundColor)

  const invitation = page.getByRole('dialog', { name: 'The results are in!' })
  await expect(invitation).toBeVisible()
  await screenshot('invitation')
  await check(invitation.getByRole('link', { name: 'Click here' }), 'text-violet-900')
  await page.keyboard.press('Escape')
  const previews = page.getByRole('link', { name: 'Click here to see your survey average' })
  await expect(previews).toHaveCount(3)
  await screenshot('dashboard')
  await check(page.getByRole('link', { name: 'Explore reports in the store' }), 'text-violet-900')
  for (const preview of await previews.all()) {
    await check(preview, 'bg-violet-900')
  }

  await previews.first().click()
  await expect(page.getByRole('heading', { name: 'Employee Feedback Data Dashboard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible()
  await screenshot('store')
  for (const reportLink of await page.getByRole('link', { name: 'View Report' }).all()) {
    await check(reportLink, 'text-violet-900')
  }
  const addToCart = page.getByRole('button', { name: 'Add to cart' })
  await check(addToCart, 'bg-violet-900')
  await addToCart.scrollIntoViewIfNeeded()
  await screenshot('store-actions')
  if (testInfo.project.name === 'chromium') {
    const restingBackground = await backgroundOf(addToCart)
    await addToCart.hover()
    await expect.poll(() => backgroundOf(addToCart)).not.toBe(restingBackground)
  }
  await addToCart.click()
  await expect(page.getByRole('button', { name: 'Added to cart' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Added to cart' })).toHaveCSS('opacity', '0.5')

  await page.getByRole('link', { name: /Cart/ }).first().click()
  const checkoutLink = page.getByRole('link', { name: 'Go To Checkout' })
  await expect(checkoutLink).toBeVisible()
  await screenshot('cart')
  await check(checkoutLink, 'bg-violet-900')
  await expect(page.getByRole('button', { name: 'Remove Standard Report Package' })).toHaveClass(/hover:text-red-600/)
  await page.getByRole('button', { name: 'Save for later' }).focus()
  await page.keyboard.press('Tab')
  await expect(checkoutLink).toBeFocused()
  await expect(checkoutLink).toHaveCSS('outline-style', 'solid')

  await checkoutLink.click()
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await page.getByRole('button', { name: /Request an invoice/ }).click()
  await screenshot('checkout')
  await check(page.getByRole('button', { name: 'Request invoice', exact: true }), 'bg-violet-900')
})
