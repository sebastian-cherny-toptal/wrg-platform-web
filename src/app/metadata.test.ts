import { describe, expect, it } from 'vitest'
import { adminPermissions, clientEntitlements, routeMetadata, routeMap } from './metadata'

describe('platform metadata', () => {
  it('preserves legacy entitlement and permission shortcodes', () => {
    expect(clientEntitlements).toContain('WFR_Access')
    expect(clientEntitlements).toContain('CR_Access')
    expect(adminPermissions).toContain('syncCheckmartketAndZohoAccess')
    expect(adminPermissions).toContain('previewClientsDashboardAccess')
  })

  it('defines unique route identifiers and paths', () => {
    expect(new Set(routeMetadata.map((route) => route.id)).size).toBe(routeMetadata.length)
    expect(routeMap.adminProjects).toBe('/admin/projects')
    expect(routeMap.wfr).toBe('/employee-response-breakdown')
  })
})
