import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { useAppStore } from '../store/app-store'

const payment = vi.hoisted<{ status: string; next_action: unknown }>(() => ({ status: 'processing', next_action: undefined }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: () => <div>Secure payment form</div>,
  useElements: () => ({}),
  useStripe: () => ({ confirmPayment: () => Promise.resolve({ paymentIntent: { id: 'pi_ach', ...payment } }) }),
}))

vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
const { CheckoutPage } = await import('./client')

function setup() {
  useAppStore.getState().setSession({
    user: { id: 'client', displayName: 'Client', email: 'client@example.test', role: 'client', permissions: [], programs: [{ id: 'program', name: 'Program', year: 2026, organizationName: 'Organization', entitlements: {} }] },
    expiresAt: '2099-01-01T00:00:00Z', verifiedAt: '2026-01-01T00:00:00Z', impersonation: null,
  })
  useAppStore.getState().addToCart({ productId: 'report-response-detail', name: 'Response Detail', priceCents: 42500 })
  const create = vi.spyOn(api.commerce, 'createPaymentIntent').mockImplementation((input) => Promise.resolve({ client_secret: `${input.paymentMethod}_secret` }))
  const confirm = vi.spyOn(api.commerce, 'confirmPayment')
  render(<MemoryRouter><CheckoutPage /></MemoryRouter>)
  return { create, confirm }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); useAppStore.getState().setSession(null); payment.next_action = undefined; payment.status = 'processing' })

describe('ACH checkout', () => {
  it('removes the card fee and submits processing payments without granting access or inviting another payment', async () => {
    const { create, confirm } = setup()
    await screen.findByText('Secure payment form')
    expect(screen.getByRole('button', { name: 'Complete Purchase' })).toHaveClass('bg-violet-900')
    expect(screen.getByText('Card fee (3%)')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /US bank account \(ACH\)/ }))
    await waitFor(() => expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ paymentMethod: 'ach', amount: 425, currency: 'USD' })))
    expect(screen.queryByText('Card fee (3%)')).toBeNull()
    await screen.findByText('Secure payment form')
    fireEvent.click(screen.getByRole('button', { name: 'Complete Purchase' }))
    await screen.findByRole('heading', { name: 'Payment submitted' })
    expect(confirm).not.toHaveBeenCalled()
    expect(useAppStore.getState().cart).toEqual([])
    expect(useAppStore.getState().session?.user.programs[0]?.entitlements).toEqual({})
    expect(screen.queryByRole('button', { name: 'Complete Purchase' })).toBeNull()
  })

  it('shows Stripe’s verification link when microdeposits are required', async () => {
    payment.status = 'requires_action'
    payment.next_action = { type: 'verify_with_microdeposits', verify_with_microdeposits: { hosted_verification_url: 'https://payments.stripe.com/verify/test' } }
    const { confirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: /US bank account \(ACH\)/ }))
    await screen.findByText('Secure payment form')
    fireEvent.click(screen.getByRole('button', { name: 'Complete Purchase' }))
    expect(await screen.findByRole('link', { name: 'Verify bank account with Stripe' })).toHaveAttribute('href', 'https://payments.stripe.com/verify/test')
    expect(confirm).not.toHaveBeenCalled()
  })
})
