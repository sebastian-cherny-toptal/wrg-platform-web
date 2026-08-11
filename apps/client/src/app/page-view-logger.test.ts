import { describe, expect, it } from 'vitest'
import { buildPageViewEvent, sanitizePageViewQuery } from './page-view-logger'

describe('page-view logging', () => {
  it('redacts sensitive query parameters and preserves repeated values', () => {
    expect(sanitizePageViewQuery('?program=demo&token=secret&tag=a&tag=b')).toEqual({
      program: 'demo',
      token: '[REDACTED]',
      tag: ['a', 'b'],
    })
  })

  it('builds a structured page-view event', () => {
    const event = buildPageViewEvent(
      { pathname: '/admin/projects', search: '?organizationId=org-1' },
      'client',
    )

    expect(event).toMatchObject({
      event: 'page_view',
      navigation: 'client',
      path: '/admin/projects',
      query: { organizationId: 'org-1' },
    })
    expect(event.timestamp).toEqual(expect.any(String))
  })
})
