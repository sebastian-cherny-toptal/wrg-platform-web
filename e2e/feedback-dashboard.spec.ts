import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test, type Page } from '@playwright/test'

const dashboardUrl = 'https://www.feedbackdatadashboard.com'
const username = 'Cohen_22_MM_883'
const email = 'sebastian.cherny+e2e@toptal.com'
const execFileAsync = promisify(execFile)
const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url))

async function downloadChart(page: Page, title: string, format: 'PNG' | 'SVG') {
  const card = page.getByRole('heading', { name: title, exact: true }).locator('..')
  const downloadControl = card.locator('.download-exclude')
  await expect(downloadControl).toHaveCount(1)
  await downloadControl.locator('img').click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByText(`Download as ${format}`, { exact: true }).last().click()
  return downloadPromise
}

async function downloadDetailedResultsCard(page: Page, title: string) {
  const card = page.locator('.dr-pie-card').filter({ hasText: title })
  await expect(card).toHaveCount(1)
  await card.locator('.download-exclude img').click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByText('Download as PNG', { exact: true }).last().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`${title}.png`)

  const downloadPath = await download.path()
  const pngBytes = await readFile(downloadPath)
  expect(pngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  return download
}

async function readXlsxXml(downloadPath: string) {
  const { stdout: entryList } = await execFileAsync('unzip', ['-Z1', downloadPath])
  const entries = entryList.trim().split('\n').filter(Boolean)
  expect(entries).toContain('xl/workbook.xml')
  expect(entries.some((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry))).toBe(true)

  const filesToRead = entries.filter(
    (entry) => entry === 'xl/workbook.xml' || entry === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(entry),
  )
  const xml = await Promise.all(
    filesToRead.map(async (entry) => (await execFileAsync('unzip', ['-p', downloadPath, entry])).stdout),
  )
  return xml.join('\n')
}

async function logInToFeedbackDashboard(page: Page) {
  await page.goto(`${dashboardUrl}/login`, { waitUntil: 'domcontentloaded' })

  const usernameInput = page.getByPlaceholder('Enter your Username', { exact: true })
  await expect(usernameInput).toHaveCount(1)
  await usernameInput.fill(username)

  const loginButton = page.getByRole('button', { name: 'Log In', exact: true })
  await expect(loginButton).toHaveCount(1)
  await loginButton.click()

  await expect(
    page.getByRole('heading', {
      name: 'Are you an employee or representative of this organization?',
      exact: true,
    }),
  ).toBeVisible()

  const yesButton = page.getByRole('button', { name: 'Yes', exact: true })
  await expect(yesButton).toHaveCount(1)
  await yesButton.click()

  const emailInput = page.getByPlaceholder('Email', { exact: true })
  await expect(emailInput).toHaveCount(1)
  await emailInput.fill(email)

  const continueButton = page.getByRole('button', { name: 'Continue Log In', exact: true })
  await expect(continueButton).toHaveCount(1)
  await continueButton.click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole('heading', { name: 'Best Places to Work in Money Management 2025', exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

test.describe('Feedback Data Dashboard', () => {
  test('downloads dashboard charts and verifies workforce feedback report data', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The fixed PNG fixture is captured for Desktop Chrome.')
    await logInToFeedbackDashboard(page)

    const selectedYear = page.getByRole('button', { name: '2025', exact: true })
    await expect(selectedYear).toHaveClass(/bg-\[#DDD6FE\]/)

    const completedSurveys = page.getByText('# of Surveys Completed', { exact: true }).locator('..')
    await expect(completedSurveys.getByText('199', { exact: true })).toBeVisible()

    const responseRateDownload = await downloadChart(page, 'Response Rate Overview', 'SVG')
    expect(responseRateDownload.suggestedFilename()).toBe('Response Rate Overview.svg')
    const responseRatePath = await responseRateDownload.path()
    const responseRateSvg = await readFile(responseRatePath, 'utf8')
    expect(responseRateSvg.trimStart()).toMatch(/^<svg\b/)
    expect(responseRateSvg).toContain('</svg>')

    const averageResponseDownload = await downloadChart(
      page,
      'Average Positive and Average Negative Response',
      'PNG',
    )
    expect(averageResponseDownload.suggestedFilename()).toBe(
      'Average Positive and Average Negative Response.png',
    )
    const downloadedPngPath = testInfo.outputPath('downloaded-average-positive-and-negative-response.png')
    await averageResponseDownload.saveAs(downloadedPngPath)
    await testInfo.attach('downloaded-average-response-png', {
      path: downloadedPngPath,
      contentType: 'image/png',
    })
    const downloadedPng = await readFile(downloadedPngPath)
    const fixedPng = await readFile(
      path.join(fixtureDirectory, 'fixtures', 'average-positive-and-negative-response.png'),
    )
    const localFixedPng = await readFile(
      path.join(fixtureDirectory, 'fixtures', 'average-positive-and-negative-response.png'),
    )
    
    if (process.env.TEST_IMAGES === 'true') {
      const downloadedHash = createHash('sha256').update(downloadedPng).digest('hex')
      const fixedHash = createHash('sha256').update(fixedPng).digest('hex')
      const localFixedHash = createHash('sha256').update(localFixedPng).digest('hex')
      expect(downloadedPng.equals(fixedPng) || downloadedPng.equals(localFixedPng), `PNG mismatch. downloaded=${downloadedHash}, fixed=${fixedHash}, localFixed=${localFixedHash}`).toBe(true)
    }

    const viewReport = page.locator('a[href="/employee-response-breakdown"]')
    await expect(viewReport).toHaveCount(1)
    await viewReport.click()
    await expect(page).toHaveURL(/\/employee-response-breakdown$/)
    await expect(
      page.getByRole('heading', { name: 'Employee Response Breakdown 2025', exact: true }),
    ).toBeVisible()

    const genderButton = page.getByText('Gender', { exact: true })
    await expect(genderButton).toHaveCount(1)
    await genderButton.press('Enter')
    const genderSection = genderButton.locator('xpath=../../..')
    await expect(genderSection).toContainText(/Female\s*81/)
    await expect(genderSection).toContainText(/Male\s*118/)

    const jobLevelButton = page.getByText('Job Level', { exact: true })
    await expect(jobLevelButton).toHaveCount(1)
    await jobLevelButton.press('Enter')
    const jobLevelSection = jobLevelButton.locator('xpath=../../..')
    await expect(jobLevelSection).toContainText(/EVP\s*13/)

    const reportDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Report', exact: true }).click()
    const reportDownload = await reportDownloadPromise
    expect(reportDownload.suggestedFilename()).toMatch(/\.xlsx$/i)
    const reportPath = await reportDownload.path()
    const workbookBytes = await readFile(reportPath)
    expect(workbookBytes.subarray(0, 2).toString()).toBe('PK')
    const workbookXml = await readXlsxXml(reportPath)
    expect(workbookXml).toContain('GENDER')
    expect(workbookXml).toContain('Female')
    expect(workbookXml).toContain('Male')
    expect(workbookXml).toContain('JOB LEVEL')
    expect(workbookXml).toContain('EVP')
    expect(workbookXml).toContain('<v>81</v>')
    expect(workbookXml).toContain('<v>118</v>')
    expect(workbookXml).toContain('<v>13</v>')
  })

  test('downloads detailed results charts and manages the Your Job detail panel', async ({ page }) => {
    await logInToFeedbackDashboard(page)

    const mobileHeader = page.locator('#content-layout-header')
    if (await mobileHeader.isVisible()) {
      await mobileHeader.locator('button').last().click()
      await expect(page.locator('#side-menu-drawer')).toHaveClass(/show/)
    }

    const sidebar = page.locator('#side-menu-wrapper:visible, #side-menu-drawer.show').first()
    const detailedResultsButton = sidebar.getByText('Detailed Results', { exact: true })
    await expect(detailedResultsButton).toHaveCount(1)
    await detailedResultsButton.press('Enter')
    await expect(page).toHaveURL(/\/detailed-results$/)
    await expect(page.getByRole('heading', { name: 'Detailed Results 2025', exact: true })).toBeVisible()

    await downloadDetailedResultsCard(page, 'Core Employee Experience')

    const yourJobCard = page.locator('.dr-pie-card').filter({ hasText: 'Your Job' })
    await expect(yourJobCard).toHaveCount(1)
    await yourJobCard.click()

    const detailPanel = page.locator('div.border-2.border-solid').filter({ hasText: 'Your Job' })
    await expect(detailPanel).toHaveCount(1, { timeout: 30_000 })
    await expect(detailPanel.locator('.chart-row').first()).toBeVisible()

    await detailPanel.locator('.download-exclude img').click()
    const detailDownloadPromise = page.waitForEvent('download')
    await page.getByText('Download as PNG', { exact: true }).last().click()
    const detailDownload = await detailDownloadPromise
    expect(detailDownload.suggestedFilename()).toBe('Your Job.png')
    const detailDownloadPath = await detailDownload.path()
    const detailPngBytes = await readFile(detailDownloadPath)
    expect(detailPngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)

    const closeDetailButton = detailPanel.locator('button')
    await expect(closeDetailButton).toHaveCount(1)
    await closeDetailButton.click()
    await expect(detailPanel).toHaveCount(0)
  })

  test('logs in and opens the demographic response breakdown', async ({ page }) => {
    await logInToFeedbackDashboard(page)

    await expect(page.locator('#side-menu-wrapper').getByText(username, { exact: true })).toBeVisible()
    await expect(page.getByText('Welcome, Cohen & Steers!', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My Reports', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workforce Feedback Results', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Employee Verbatims', exact: true })).toBeVisible()

    const breakdownButton = page.locator('#side-menu-wrapper').getByText('Employee Response Breakdown', { exact: true })
    await expect(breakdownButton).toHaveCount(1)
    await breakdownButton.press('Enter')

    await expect(page).toHaveURL(/\/employee-response-breakdown$/)
    await expect(
      page.getByRole('heading', { name: 'Employee Response Breakdown 2025', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Total Number of Survey Responses by Demographic Category',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Personal Demographics', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workplace Demographics', exact: true })).toBeVisible()
    expect(await page.locator('svg').count()).toBeGreaterThan(0)

    const genderButton = page.getByText('Gender', { exact: true })
    await expect(genderButton).toHaveCount(1)
    await genderButton.press('Enter')

    await expect(page.getByText('Female', { exact: true })).toBeVisible()
    await expect(page.getByText('Male', { exact: true })).toBeVisible()
  })

  test('opens detailed results, verifies percentage graphs, and opens filters', async ({ page }) => {
    await logInToFeedbackDashboard(page)

    const detailedResultsButton = page.locator('#side-menu-wrapper').getByText('Detailed Results', { exact: true })
    await expect(detailedResultsButton).toHaveCount(1)
    await detailedResultsButton.press('Enter')

    await expect(page).toHaveURL(/\/detailed-results$/)
    await expect(page.getByRole('heading', { name: 'Detailed Results 2025', exact: true })).toBeVisible()
    await expect(
      page.getByText(
        'Filter survey feedback by various demographics within your respondent population and dig into employee perspectives of each of the nine focus areas of the workplace.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByText('Category Averages', { exact: true }).first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/\d+%/)
    expect(await page.locator('svg').count()).toBeGreaterThan(0)

    const filtersButton = page.getByRole('button', { name: 'Filters', exact: true })
    await expect(filtersButton).toHaveCount(1)
    await filtersButton.click()

    await expect(page.getByText('Select a category to view filters', { exact: true })).toBeVisible()
  })

  test('navigates through response patterns and annual trends', async ({ page }) => {
    await logInToFeedbackDashboard(page)

    const responsePatternsButton = page.locator('#side-menu-wrapper').getByText('Response Patterns', { exact: true })
    await expect(responsePatternsButton).toHaveCount(1)
    await responsePatternsButton.press('Enter')

    await expect(page).toHaveURL(/\/response-patterns$/)
    await expect(page.getByRole('heading', { name: 'Response Patterns 2025', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'High % Agreement', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Moderate % Agreement', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'High % Disagreement', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Preview the Report', exact: true })).toBeVisible()
    expect(await page.locator('svg').count()).toBeGreaterThan(0)

    const annualTrendsButton = page.locator('#side-menu-wrapper').getByText('Annual Trends', { exact: true })
    await expect(annualTrendsButton).toHaveCount(1)
    await annualTrendsButton.press('Enter')

    await expect(page).toHaveURL(/\/annual-trends$/)
    await expect(page.getByRole('heading', { name: 'Annual Trends 2025', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Survey Average', exact: true })).toBeVisible()
    await expect(page.getByText('vs last year', { exact: true })).toBeVisible()
    const categoryButton = page.getByRole('button', { name: 'Core Employee Experience', exact: true })
    await expect(categoryButton).toHaveCount(1)
    await categoryButton.click()
    await expect(page.locator('body')).toContainText(/\d+%/)
    expect(await page.locator('svg').count()).toBeGreaterThan(0)
  })
})
