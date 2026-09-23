import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { Session } from '../api/schemas'
import { useAppStore } from '../store/app-store'
import { AnnualTrendsPage } from './client-reports'

const session: Session = {
  user: {
    id: 'client-1',
    displayName: 'Client User',
    email: 'client@example.test',
    role: 'client',
    permissions: [],
    programs: [{
      id: 'program-2026',
      name: 'Example 2026',
      year: 2026,
      organizationName: 'Example Organization',
      entitlements: { WFR_Access: 'yes' },
    }],
  },
  expiresAt: '2099-01-01T00:00:00.000Z',
  verifiedAt: '2026-01-01T00:00:00.000Z',
  impersonation: null,
}

describe('Annual Trends page', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useAppStore.getState().setSession(null)
  })

  it('uses the current-year agreement color for the current survey average', async () => {
    useAppStore.getState().setSession(session)
    vi.spyOn(api.reports, 'annualResponseRate').mockResolvedValue({
      success: true,
      message: 'success',
      data: [{ '2026': '93', '2025': '91' }],
    })
    vi.spyOn(api.reports, 'annualCategories').mockResolvedValue({ success: true, data: [] })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AnnualTrendsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const currentAverage = await screen.findByText('93%')
    const currentAverageDonut = currentAverage.parentElement?.parentElement?.parentElement
    expect(currentAverageDonut).toHaveStyle({ '--donut-color': '#7c3aed' })
    expect(screen.getByText('2% vs last year')).toHaveClass(
      'bg-emerald-100',
      'text-emerald-800',
    )
  })

  it('uses a light red badge when agreement decreased from the previous year', async () => {
    useAppStore.getState().setSession(session)
    vi.spyOn(api.reports, 'annualResponseRate').mockResolvedValue({
      success: true,
      message: 'success',
      data: [{ '2026': '88', '2025': '91' }],
    })
    vi.spyOn(api.reports, 'annualCategories').mockResolvedValue({ success: true, data: [] })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AnnualTrendsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('-3% vs last year')).toHaveClass(
      'bg-red-50',
      'text-red-500',
    )
  })
})
