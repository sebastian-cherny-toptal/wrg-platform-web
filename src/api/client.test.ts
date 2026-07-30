import { beforeEach, describe, expect, it } from 'vitest'
import { api } from './client'

describe('fixture session persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores an authenticated fixture session after a page refresh', async () => {
    const login = await api.auth.clientLogin({ username: 'demo-client', email: 'client@example.invalid' })

    if (login.status !== 'authenticated') throw new Error('Fixture login did not authenticate')
    expect(await api.session.get()).toEqual(login.session)
  })

  it('clears the persisted fixture session on logout', async () => {
    await api.auth.clientLogin({ username: 'demo-client', email: 'client@example.invalid' })
    await api.session.logout()

    expect(await api.session.get()).toBeNull()
  })
})
