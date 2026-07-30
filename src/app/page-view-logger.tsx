import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const sensitiveQueryKey = /authorization|password|passcode|secret|token|api[-_]?key|signature|otp|code/i

export type PageViewLocation = {
  pathname: string
  search: string
}

export function sanitizePageViewQuery(search: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}

  for (const [key, value] of new URLSearchParams(search)) {
    const safeValue = sensitiveQueryKey.test(key) ? '[REDACTED]' : value.slice(0, 512)
    const existing = query[key]
    if (existing === undefined) {
      query[key] = safeValue
    } else if (Array.isArray(existing)) {
      existing.push(safeValue)
    } else {
      query[key] = [existing, safeValue]
    }
  }

  return query
}

export function buildPageViewEvent(
  location: PageViewLocation,
  navigation: 'initial' | 'client',
): Record<string, unknown> {
  return {
    event: 'page_view',
    navigation,
    path: location.pathname,
    query: sanitizePageViewQuery(location.search),
    title: document.title || undefined,
    referrer: document.referrer ? new URL(document.referrer).origin : undefined,
    timestamp: new Date().toISOString(),
  }
}

export function PageViewLogger() {
  const location = useLocation()
  const hasVisited = useRef(false)

  useEffect(() => {
    const event = buildPageViewEvent(
      { pathname: location.pathname, search: location.search },
      hasVisited.current ? 'client' : 'initial',
    )
    hasVisited.current = true
    console.info(event)
  }, [location.pathname, location.search])

  return null
}
