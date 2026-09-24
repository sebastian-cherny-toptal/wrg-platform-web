import { readdir, readFile } from 'node:fs/promises'

const acceptanceDirectory = new globalThis.URL('./', import.meta.url)
const entries = await readdir(acceptanceDirectory, { recursive: true })
const specs = entries.filter((entry) => entry.endsWith('.acceptance.spec.ts'))

if (specs.length === 0) {
  throw new Error('The candidate-stack acceptance suite must contain at least one spec')
}

const forbiddenPatterns = [
  { pattern: /\b(?:browserContext|context|page)\.route\s*\(/u, reason: 'request interception' },
  { pattern: /\brouteFromHAR\s*\(/u, reason: 'HAR-backed request interception' },
  { pattern: /\b(?:browserContext|context|page)\.addInitScript\s*\(/u, reason: 'injected browser state' },
  { pattern: /\broute\.fulfill\s*\(/u, reason: 'mocked API responses' },
  { pattern: /\binstallClientApiFixture\b/u, reason: 'the mocked client API fixture' },
  { pattern: /https?:\/\/(?:www\.|api\.)?feedbackdatadashboard\.com\b/iu, reason: 'production coupling' },
]

for (const spec of specs) {
  const source = await readFile(new globalThis.URL(spec, acceptanceDirectory), 'utf8')
  for (const { pattern, reason } of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${spec} uses ${reason}; acceptance specs must exercise the candidate stack`)
    }
  }
}

globalThis.console.log(
  `Verified ${specs.length} candidate-stack acceptance spec${specs.length === 1 ? '' : 's'}`,
)
