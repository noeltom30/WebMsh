import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '../../../src/api'
import { AuthProvider } from '../../../src/context/AuthContext'
import { useAuth } from '../../../src/context/useAuth'

function Probe() {
  const { user, loading, signOut, refreshUser } = useAuth()
  return (
    <div>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => refreshUser()}>refresh</button>
      <button onClick={() => signOut()}>logout</button>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Irfan Integration Tests', () => {
  it('IRF-IT-001 hydrates authenticated user', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ id: 1, email: 'irfan.it1@example.com' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('email').textContent).toBe('irfan.it1@example.com')
  })
  it('IRF-IT-002 falls back to none when me fails', async () => {
    vi.spyOn(api, 'me').mockRejectedValue(new Error('401'))
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('none'))
  })
  it('IRF-IT-003 signOut clears user', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ id: 2, email: 'irfan.it3@example.com' })
    vi.spyOn(api, 'logout').mockResolvedValue({ message: 'Signed out' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('irfan.it3@example.com'))
    screen.getByText('logout').click()
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('none'))
  })
  it('IRF-IT-004 refreshUser updates user', async () => {
    const meMock = vi.spyOn(api, 'me')
    meMock.mockResolvedValueOnce({ id: 3, email: 'old@example.com' })
    meMock.mockResolvedValueOnce({ id: 3, email: 'new@example.com' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('old@example.com'))
    screen.getByText('refresh').click()
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('new@example.com'))
  })
  it('IRF-IT-005 keeps loading false after init', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({ id: 4, email: 'irfan.it5@example.com' })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
  })
})
