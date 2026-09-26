import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { useAppStore } from '../store/app-store'

vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: () => <div>Secure payment form</div>,
  useElements: () => ({}),
  useStripe: () => ({ confirmPayment: () => Promise.resolve({ paymentIntent: { id: 'pi_card', status: 'succeeded' } }) }),
}))

vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
const { CheckoutPage } = await import('./client')

function setup(currency = 'USD') {
  useAppStore.getState().setSession({
    user: { id: 'client', displayName: 'Client', email: 'client@example.test', role: 'client', permissions: [], programs: [{ id: 'program', name: 'Program', year: 2026, currency, organizationName: 'Organization', entitlements: {} }] },
    expiresAt: '2099-01-01T00:00:00Z', verifiedAt: '2026-01-01T00:00:00Z', impersonation: null,
  })
  useAppStore.getState().addToCart({ productId: 'report-response-detail', name: 'Response Detail', priceCents: 42500 })
  const create = vi.spyOn(api.commerce, 'createPaymentIntent').mockImplementation((input) => Promise.resolve({ client_secret: `${input.paymentMethod}_secret` }))
  const confirm = vi.spyOn(api.commerce, 'confirmPayment')
  render(<MemoryRouter><CheckoutPage /></MemoryRouter>)
  return { create, confirm }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); useAppStore.getState().setSession(null) })

describe('checkout payment options', () => {
  it('offers fee-free credit card and invoice payments without ACH', async () => {
    const { create } = setup()
    await screen.findByText('Secure payment form')
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'card', amount: 425, currency: 'USD' })))
    expect(screen.getByRole('button', { name: 'Complete Purchase' })).toHaveClass('bg-violet-900')
    expect(screen.queryByText('Card fee (3%)')).toBeNull()
    expect(screen.queryByRole('button', { name: /US bank account \(ACH\)/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Credit card/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Invoice me/ })).toBeVisible()
  })

  it('uses the selected program currency for card payments', async () => {
    const { create } = setup('GBP')
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'card', amount: 425, currency: 'GBP' })))
    expect(screen.getAllByText('£425.00')).toHaveLength(2)
  })

  it('submits invoice requests without a payment fee', async () => {
    const requestInvoice = vi.spyOn(api.commerce, 'requestInvoice').mockResolvedValue({ success: true, status: 'pending', message: 'Invoice requested' })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Invoice me/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Request invoice' }))
    await waitFor(() => expect(requestInvoice).toHaveBeenCalledWith(expect.objectContaining({ amount: 425, currency: 'USD' })))
    expect(await screen.findByRole('heading', { name: 'Invoice request received' })).toBeVisible()
  })
})
