import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const placeholderPattern = /(?:^|[./_-])(api(?:_v1)?_base_url|compatibility_api_base_url|admin_app_url|replace(?:[_-]?me)?|placeholder)(?:$|[./_-])/iu

export function productionUrl(name, value) {
  const candidate = value?.trim()
  if (!candidate) throw new Error(`${name} is required for a production build`)
  if (placeholderPattern.test(candidate) || /[<>]/u.test(candidate)) {
    throw new Error(`${name} contains a placeholder value`)
  }

  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an absolute HTTP(S) URL without credentials`)
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !local) {
    throw new Error(`${name} must use HTTPS unless it targets localhost`)
  }
  return url
}

export function validateFrontendEnvironment(app, environment = process.env) {
  const api = productionUrl('VITE_API_BASE_URL', environment.VITE_API_BASE_URL)
  if (app === 'client') {
    const apiV1 = productionUrl('VITE_API_V1_BASE_URL', environment.VITE_API_V1_BASE_URL)
    const compatibility = productionUrl(
      'VITE_COMPATIBILITY_API_BASE_URL',
      environment.VITE_COMPATIBILITY_API_BASE_URL,
    )
    productionUrl('VITE_ADMIN_APP_URL', environment.VITE_ADMIN_APP_URL)
    const origins = new Set([api.origin, apiV1.origin, compatibility.origin])
    if (origins.size !== 1) {
      throw new Error('The client API URLs must use the same origin')
    }
  } else if (app !== 'admin') {
    throw new Error(`Unknown frontend application: ${app}`)
  }
  return { readinessUrl: new URL('/api/v1/health/ready', api).toString() }
}

export function renderNginxConfig(template, readinessUrl) {
  if (!template.includes('__API_READINESS_URL__')) {
    throw new Error('The nginx template is missing __API_READINESS_URL__')
  }
  return template.replaceAll('__API_READINESS_URL__', readinessUrl)
}

async function main() {
  const argumentsByName = new Map()
  for (let index = 2; index < process.argv.length; index += 2) {
    argumentsByName.set(process.argv[index], process.argv[index + 1])
  }
  const app = argumentsByName.get('--app')
  const templatePath = argumentsByName.get('--template')
  const outputPath = argumentsByName.get('--output')
  if (!app || !templatePath || !outputPath) {
    throw new Error('Usage: render-nginx-config.mjs --app <client|admin> --template <path> --output <path>')
  }
  const { readinessUrl } = validateFrontendEnvironment(app)
  const template = await readFile(templatePath, 'utf8')
  await writeFile(outputPath, renderNginxConfig(template, readinessUrl))
  globalThis.console.log(`Validated ${app} production configuration; /healthz checks ${readinessUrl}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
