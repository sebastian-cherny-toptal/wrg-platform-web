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
    expect(screen.getByText(/2%/).parentElement).toHaveClass(
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

    expect((await screen.findByText(/-3%/)).parentElement).toHaveClass(
      'bg-red-50',
      'text-red-500',
    )
  })

  it('normalizes annual distributions and renders contiguous filled sectors', async () => {
    useAppStore.getState().setSession(session)
    vi.spyOn(api.reports, 'annualResponseRate').mockResolvedValue({
      success: true,
      message: 'success',
      data: [{ '2026': '89', '2025': '90' }],
    })
    vi.spyOn(api.reports, 'annualCategories').mockResolvedValue({
      success: true,
      data: [
        {
          category: { category: 'Core Employee Experience' },
          '2026': {
            data: [
              { ResponseCaption: 'Agree', numberOfResponses: 894, percent: 0.894, percentage: 90, colorCode: '' },
              { ResponseCaption: 'Neutral', numberOfResponses: 91, percent: 0.091, percentage: 9, colorCode: '' },
              { ResponseCaption: 'Disagree', numberOfResponses: 15, percent: 0.015, percentage: 2, colorCode: '' },
            ],
            questionIds: [],
          },
          '2025': {
            data: [
              { ResponseCaption: 'Agree', numberOfResponses: 900, percent: 0.9, percentage: 90, colorCode: '' },
              { ResponseCaption: 'Neutral', numberOfResponses: 90, percent: 0.09, percentage: 9, colorCode: '' },
              { ResponseCaption: 'Disagree', numberOfResponses: 10, percent: 0.01, percentage: 1, colorCode: '' },
            ],
            questionIds: [],
          },
        },
      ],
    })
    vi.spyOn(api.reports, 'annualDetails').mockResolvedValue({
      success: true,
      message: 'success',
      category: 'Core Employee Experience',
      data: [],
    })

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AnnualTrendsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const distribution = await screen.findByRole('img', {
      name: '2026: 89% Agreement, 9% Neutral, 2% Disagreement',
    })
    const segments = Array.from(
      distribution.querySelectorAll<SVGPathElement>('path[data-donut-segment]'),
    )
    expect(segments).toHaveLength(3)
    const angles = segments.map((segment) => ({
      offset: Number(segment.dataset.donutOffset),
      value: Number(segment.dataset.donutValue),
    }))
    expect(angles[0]?.offset).toBe(0)
    expect(angles[1]?.offset).toBeCloseTo(angles[0]?.value ?? 0, 10)
    expect(angles[2]?.offset).toBeCloseTo(
      (angles[0]?.value ?? 0) + (angles[1]?.value ?? 0),
      10,
    )
    expect(
      (angles[2]?.offset ?? 0) + (angles[2]?.value ?? 0),
    ).toBeCloseTo(100, 10)
    expect(segments.every((segment) => !segment.getAttribute('d')?.includes('NaN'))).toBe(true)
    expect(distribution.querySelector('circle[stroke-dasharray]')).toBeNull()
  })
})
