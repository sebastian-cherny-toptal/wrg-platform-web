import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ClientLoginPage } from './auth'
import { useAppStore } from '../store/app-store'

describe('client authentication', () => {
  beforeEach(() => {
    useAppStore.setState({ session: null, selectedProgramId: null, cart: [] })
  })

  it('follows the legacy username → org confirm → email pattern', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<ClientLoginPage />} />
            <Route path="/dashboard" element={<h1>Dashboard loaded</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Username'), 'demo-client')
    await user.click(screen.getByRole('button', { name: 'Log In' }))

    expect(
      await screen.findByText('Are you an employee or representative of this organization?'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    await user.type(screen.getByLabelText('Email'), 'client@example.invalid')
    await user.click(screen.getByRole('button', { name: 'Continue Log In' }))

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument()
    expect(useAppStore.getState().session?.verifiedAt).toBeTruthy()
  })
})
