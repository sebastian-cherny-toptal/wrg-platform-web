import assert from 'node:assert/strict'
import test from 'node:test'
import {
  renderNginxConfig,
  validateFrontendEnvironment,
} from './render-nginx-config.mjs'

const clientEnvironment = {
  VITE_API_BASE_URL: 'https://api.candidate.test/api/v1',
  VITE_API_V1_BASE_URL: 'https://api.candidate.test/api',
  VITE_COMPATIBILITY_API_BASE_URL: 'https://api.candidate.test',
  VITE_ADMIN_APP_URL: 'https://admin.candidate.test/admin/projects',
}

test('client production configuration renders the API readiness endpoint', () => {
  const result = validateFrontendEnvironment('client', clientEnvironment)
  assert.equal(result.readinessUrl, 'https://api.candidate.test/api/v1/health/ready')
  assert.equal(
    renderNginxConfig('proxy_pass __API_READINESS_URL__;', result.readinessUrl),
    'proxy_pass https://api.candidate.test/api/v1/health/ready;',
  )
})

test('production configuration rejects empty and placeholder API URLs', () => {
  assert.throws(
    () => validateFrontendEnvironment('admin', { VITE_API_BASE_URL: '' }),
    /required/u,
  )
  assert.throws(
    () => validateFrontendEnvironment('admin', { VITE_API_BASE_URL: 'https://API_BASE_URL' }),
    /placeholder/u,
  )
  assert.throws(
    () => validateFrontendEnvironment('client', {
      ...clientEnvironment,
      VITE_API_V1_BASE_URL: 'https://API_V1_BASE_URL',
    }),
    /placeholder/u,
  )
})

test('production configuration rejects insecure remote and split API origins', () => {
  assert.throws(
    () => validateFrontendEnvironment('admin', { VITE_API_BASE_URL: 'http://api.candidate.test' }),
    /HTTPS/u,
  )
  assert.throws(
    () => validateFrontendEnvironment('client', {
      ...clientEnvironment,
      VITE_COMPATIBILITY_API_BASE_URL: 'https://other.candidate.test',
    }),
    /same origin/u,
  )
})
