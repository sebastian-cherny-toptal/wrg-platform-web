import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import type { Session } from '../api/schemas'
import { useAppStore } from '../store/app-store'
import { WorkforceFeedbackPage } from './client'

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

describe('Employee Response Breakdown page', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useAppStore.getState().setSession(null)
  })

  it('keeps each demographic card independently sized and expanded', async () => {
    useAppStore.getState().setSession(session)
    vi.spyOn(api.reports, 'demographics').mockResolvedValue([
      {
        category: 'Employment Length',
        group: 'workplace',
        values: [{ label: 'Less than one year', count: 9 }],
      },
      {
        category: 'Job Status',
        group: 'workplace',
        values: [{ label: 'Full-Time', count: 99 }],
      },
    ])

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <WorkforceFeedbackPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const employmentCard = (await screen.findByRole('heading', { name: 'Employment Length' })).closest('details')
    const jobStatusCard = screen.getByRole('heading', { name: 'Job Status' }).closest('details')
    if (!employmentCard || !jobStatusCard) throw new Error('Expected both demographic cards to render')
    expect(employmentCard.parentElement).toHaveClass('items-start')

    const employmentSummary = employmentCard.querySelector('summary')
    if (!employmentSummary) throw new Error('Expected the demographic card summary to render')
    fireEvent.click(employmentSummary)
    expect(employmentCard).toHaveAttribute('open')
    expect(jobStatusCard).not.toHaveAttribute('open')
  })
})
