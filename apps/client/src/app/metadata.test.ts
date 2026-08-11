import { describe, expect, it } from 'vitest'
import { clientEntitlements, routeMetadata, routeMap } from './metadata'

describe('platform metadata', () => {
  it('preserves legacy client entitlement shortcodes', () => {
    expect(clientEntitlements).toContain('WFR_Access')
    expect(clientEntitlements).toContain('CR_Access')
  })

  it('defines unique route identifiers and paths', () => {
    expect(new Set(routeMetadata.map((route) => route.id)).size).toBe(routeMetadata.length)
    expect(routeMap.adminPreview).toBe('/admin-preview')
    expect(routeMap.wfr).toBe('/employee-response-breakdown')
  })
})
