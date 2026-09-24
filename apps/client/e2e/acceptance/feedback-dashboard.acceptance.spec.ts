import { readFile } from 'node:fs/promises'
import { expect, test, type Page, type Request } from '@playwright/test'
import { routeMetadata } from '../../src/app/metadata'

const username = process.env.ACCEPTANCE_USERNAME ?? 'test.baton'
const email = process.env.ACCEPTANCE_EMAIL ?? 'test.baton@example.test'
const expectedProgramYears = (process.env.ACCEPTANCE_PROGRAM_YEARS ?? '2024,2025,2026')
  .split(',')
  .map((year) => Number.parseInt(year.trim(), 10))

if (expectedProgramYears.some((year) => !Number.isInteger(year))) {
  throw new Error('ACCEPTANCE_PROGRAM_YEARS must be a comma-separated list of years')
}

function candidateApiOrigin() {
  const value = process.env.ACCEPTANCE_API_BASE_URL
  if (!value) throw new Error('ACCEPTANCE_API_BASE_URL is required')
  return new URL(value).origin
}

function isApplicationApiRequest(request: Request) {
  if (!['fetch', 'xhr'].includes(request.resourceType())) return false
  const pathname = new URL(request.url()).pathname
  return /^\/(?:api(?:\/v1)?|client|dashboard|payment|reports|user)(?:\/|$)/u.test(pathname)
}

function observeApiTraffic(page: Page) {
  const requests: Request[] = []
  const serverErrors: string[] = []

  page.on('request', (request) => {
    if (isApplicationApiRequest(request)) requests.push(request)
  })
  page.on('response', (response) => {
    if (isApplicationApiRequest(response.request()) && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`)
    }
  })

  return {
    assertCandidateOnly() {
      expect(requests.length, 'The browser did not call the application API').toBeGreaterThan(0)
      expect([...new Set(requests.map((request) => new URL(request.url()).origin))]).toEqual([
        candidateApiOrigin(),
      ])
      expect(serverErrors).toEqual([])
    },
  }
}

async function logIn(page: Page) {
  const loginRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/user/login')

  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue Log In' }).click()

  const request = await loginRequest
  expect(new URL(request.url()).origin, 'Login must use the candidate API').toBe(candidateApiOrigin())
  await expect(page).toHaveURL(/\/dashboard$/u)
  await page.waitForLoadState('networkidle')
}

async function currentSession(page: Page) {
  return page.evaluate(() => {
    const stored = globalThis.localStorage.getItem('wrg-client-session')
    if (!stored) throw new Error('Client session was not stored')
    return JSON.parse(stored) as {
      user: {
        programs: {
          id: string
          year: number
          entitlements: Record<string, 'yes' | 'no'>
        }[]
      }
    }
  })
}

test.describe('Railway candidate stack', () => {
  test('logs in with seeded data and downloads a real dashboard chart', async ({ page }) => {
    const traffic = observeApiTraffic(page)
    await logIn(page)

    const session = await currentSession(page)
    expect(session.user.programs.map((program) => program.year).sort((a, b) => a - b)).toEqual(
      [...expectedProgramYears].sort((a, b) => a - b),
    )
    await expect(page.getByRole('heading', { name: /Welcome,/u })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workforce Feedback Results' })).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Download Average Positive and Average Negative Response' })
      .click()
    await page.getByRole('menuitem', { name: 'Download as PNG' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('Average Positive and Average Negative Response.png')
    const path = await download.path()
    if (!path) throw new Error('Downloaded chart is unavailable')
    expect((await readFile(path)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

    traffic.assertCandidateOnly()
  })

  test('opens every entitled client view without a server error', async ({ page }) => {
    test.setTimeout(180_000)
    const traffic = observeApiTraffic(page)
    await logIn(page)

    const session = await currentSession(page)
    const program = session.user.programs.find(
      (candidate) => candidate.year === Math.max(...expectedProgramYears),
    )
    expect(program).toBeDefined()
    if (!program) throw new Error('Latest seeded program was not assigned to the acceptance user')

    for (const route of routeMetadata.filter((candidate) => candidate.access === 'client')) {
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')
      if (route.entitlement && program.entitlements[route.entitlement] !== 'yes') {
        await expect(page).toHaveURL(/\/forbidden$/u)
        await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
        continue
      }

      await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}$`, 'u'))
      await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 20_000 })
      await expect(page.locator('body')).not.toContainText('Something went wrong')
    }

    traffic.assertCandidateOnly()
  })
})
