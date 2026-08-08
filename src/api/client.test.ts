import { beforeEach, describe, expect, it } from 'vitest'
import { api, responsePatternsPath } from './client'

describe('fixture session persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores an authenticated fixture session after a page refresh', async () => {
    const login = await api.auth.clientLogin({ username: 'demo-client', email: 'client@example.invalid' })

    if (login.status !== 'authenticated') throw new Error('Fixture login did not authenticate')
    expect(await api.session.get()).toEqual(login.session)
  })

  it('clears the persisted fixture session on logout', async () => {
    await api.auth.clientLogin({ username: 'demo-client', email: 'client@example.invalid' })
    await api.session.logout()

    expect(await api.session.get()).toBeNull()
  })
})

describe('response-pattern report requests', () => {
  it('builds the preview request with the legacy range contract', () => {
    const path = responsePatternsPath(
      '68cac532bf1e6966358a8079',
      { neutral: [60, 79] },
      true,
    )
    const url = new URL(path, 'https://api.feedbackdatadashboard.com')

    expect(url.pathname).toBe('/client/generateHeatMap')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      selectedProgramId: '68cac532bf1e6966358a8079',
      patternMode: 'range',
      includePositive: 'false',
      includeNeutral: 'true',
      includeNegative: 'false',
      neutralMin: '60',
      neutralMax: '79',
      isPreview: 'true',
    })
  })

  it('omits isPreview for the XLSX download request', () => {
    const url = new URL(
      responsePatternsPath('program', { positive: [80, 100] }),
      'https://api.feedbackdatadashboard.com',
    )

    expect(url.searchParams.get('positiveMin')).toBe('80')
    expect(url.searchParams.get('positiveMax')).toBe('100')
    expect(url.searchParams.has('isPreview')).toBe(false)
  })
})
