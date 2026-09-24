import { defineConfig, devices } from '@playwright/test'

const productionHosts = new Set([
  'feedbackdatadashboard.com',
  'www.feedbackdatadashboard.com',
  'api.feedbackdatadashboard.com',
])

function candidateUrl(name: 'ACCEPTANCE_WEB_BASE_URL' | 'ACCEPTANCE_API_BASE_URL') {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for the Railway candidate acceptance suite`)
  }

  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must be an HTTP(S) URL`)
  }
  if (productionHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`${name} must target a candidate stack, not production`)
  }
  return url
}

const webBaseUrl = candidateUrl('ACCEPTANCE_WEB_BASE_URL')
const apiBaseUrl = candidateUrl('ACCEPTANCE_API_BASE_URL')

if (webBaseUrl.origin === apiBaseUrl.origin) {
  throw new Error('The candidate web and API services must use different origins')
}

export default defineConfig({
  testDir: './e2e/acceptance',
  testMatch: '**/*.acceptance.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: webBaseUrl.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.PLAYWRIGHT_VIDEO === 'on' ? 'retain-on-failure' : 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
