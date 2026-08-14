import { expect, test, type Page } from '@playwright/test'
import { routeMetadata } from '../src/app/metadata'

const username = 'test.baton'
const email = 'test.baton@example.test'
const expectedProgramYears = [2024, 2025, 2026]

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue Log In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/u)
}

test('every client view uses the seeded Baton Rouge database session', async ({ page }) => {
  test.skip(process.env.BATON_ROUGE_E2E !== 'true', 'Requires the isolated Baton Rouge API test stack')
  test.setTimeout(180_000)
  const serverErrors: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  await login(page)
  const session = await page.evaluate(() => {
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
  expect(session.user.programs.map((program) => program.year).sort()).toEqual(expectedProgramYears)
  const program = session.user.programs.find((candidate) => candidate.year === Math.max(...expectedProgramYears))
  expect(program).toBeDefined()
  if (!program) throw new Error('Latest Baton Rouge program was not assigned to the test user')

  const clientRoutes = routeMetadata.filter((route) => route.access === 'client')
  for (const route of clientRoutes) {
    await page.goto(route.path)
    if (route.entitlement && program.entitlements[route.entitlement] !== 'yes') {
      await expect(page).toHaveURL(/\/forbidden$/u)
      await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible()
      continue
    }
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}$`, 'u'))
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  }

  expect(serverErrors).toEqual([])
})
