import { expect, test } from '@playwright/test'

async function installSession(page: import('@playwright/test').Page) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const tokenPayload = Buffer.from(
    JSON.stringify({ exp: Math.floor(new Date(expiresAt).getTime() / 1000) }),
  ).toString('base64url')
  await page.addInitScript(
    ({ session, token }) => {
      const browserGlobal = globalThis as unknown as {
        localStorage: { setItem: (key: string, value: string) => void }
      }
      browserGlobal.localStorage.setItem('wrg-client-session', JSON.stringify(session))
      browserGlobal.localStorage.setItem('wrg-client-access-token', token)
    },
    {
      token: `e30.${tokenPayload}.signature`,
      session: {
        user: {
          id: 'demo-client',
          displayName: 'Demo Client',
          email: 'client@example.invalid',
          role: 'client',
          permissions: [],
          programs: [
            {
              id: 'demo-program-2026',
              name: 'Demo Program',
              year: 2026,
              organizationName: 'Demo Organization',
              entitlements: { WFR_Access: 'yes' },
            },
          ],
        },
        expiresAt,
        verifiedAt: new Date().toISOString(),
        impersonation: null,
      },
    },
  )
}

test('Response Patterns preserves ranges and keeps preview and download states coherent', async ({ page }) => {
  const previewUrls: URL[] = []
  await page.route('**/client/generateHeatMap?**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('isPreview') !== 'true') {
      await new Promise((resolve) => setTimeout(resolve, 1_200))
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
      return
    }
    previewUrls.push(url)
    await new Promise((resolve) => setTimeout(resolve, 1_200))
    const noMatches = url.searchParams.get('positiveMin') === '99'
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'success',
        isConfidential: false,
        data: {
          heatmapPreview: [],
          percentage: {
            positivePercentage: noMatches ? 0 : 18.56,
            neutralPercentage: noMatches ? 0 : 1.56,
            negativePercentage: 0,
            greenPercentage: noMatches ? 0 : 18.56,
            bluePercentage: noMatches ? 0 : 1.56,
            redPercentage: 0,
          },
        },
      }),
    })
  })
  await installSession(page)
  await page.goto('/response-patterns')

  const previewButton = page.getByRole('button', { name: 'Preview the Report' })
  const downloadButton = page.getByRole('button', { name: 'Download Report' })
  const highAgreementInput = page.getByPlaceholder('e.g., 80–100%')
  const moderateAgreementInput = page.getByPlaceholder('e.g., 60–79%')
  await highAgreementInput.focus()
  await highAgreementInput.fill('80.5-100')
  await expect(page.getByText('Enter a complete integer range like 60-79%.')).toBeVisible()
  await expect(previewButton).toBeDisabled()
  await highAgreementInput.fill('80-100%')
  await moderateAgreementInput.focus()
  await moderateAgreementInput.fill('60-79%')

  const moderateToggle = page.getByRole('button', { name: 'Enable Moderate % Agreement' })
  await moderateToggle.click()
  await moderateToggle.click()
  await expect(moderateAgreementInput).toHaveValue('60-79%')

  await previewButton.click()
  await expect(page.getByRole('button', { name: 'Generating preview…' })).toBeDisabled()
  await expect(page.getByRole('img', { name: 'Response pattern distribution' })).toBeVisible()
  await expect(page.getByText('18.56%')).toBeVisible()
  await expect(page.getByText('1.56%')).toBeVisible()
  await expect(page.getByText('All selected patterns will appear together in a single color-coded document.')).toBeVisible()
  await expect(downloadButton).toBeEnabled()

  const firstPreview = previewUrls[0]
  expect(firstPreview.searchParams.get('includePositive')).toBe('true')
  expect(firstPreview.searchParams.get('positiveMin')).toBe('80')
  expect(firstPreview.searchParams.get('positiveMax')).toBe('100')
  expect(firstPreview.searchParams.get('includeNeutral')).toBe('true')
  expect(firstPreview.searchParams.get('neutralMin')).toBe('60')
  expect(firstPreview.searchParams.get('neutralMax')).toBe('79')

  await moderateAgreementInput.fill('61-79%')
  await expect(downloadButton).toBeDisabled()
  await moderateAgreementInput.fill('60-79%')
  await previewButton.click()
  await expect(downloadButton).toBeEnabled()
  await downloadButton.click()
  await expect(page.getByText('Compiling report…')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Report download failed')

  await highAgreementInput.fill('99-99%')
  await moderateToggle.click()
  await previewButton.click()
  await expect(page.getByText('No cells match the selected range. Try widening the range.')).toBeVisible()
})
