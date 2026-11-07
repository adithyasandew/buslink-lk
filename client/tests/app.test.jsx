import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/app/AuthContext'
import AppRoutes from '../src/app/routes'
import * as client from '../src/api/client'
import * as owner from '../src/api/owner'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(client, 'getHealth').mockResolvedValue({ data: { status: 'ok', db: 'connected' } })
})

describe('routing and guards', () => {
  it('shows API status on the home page', async () => {
    renderAt('/')
    expect(await screen.findByText(/API status: ok/)).toBeInTheDocument()
  })

  it('shows an error when the API is unreachable', async () => {
    client.getHealth.mockRejectedValue(new Error('down'))
    renderAt('/')
    expect(await screen.findByText(/unreachable/)).toBeInTheDocument()
  })

  it('redirects unauthenticated users from a protected page to login', async () => {
    renderAt('/owner')
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('denies a logged-in user the wrong role area', async () => {
    localStorage.setItem('buslink.token', 't')
    vi.spyOn(client, 'getMe').mockResolvedValue({ name: 'Pam', role: 'passenger' })
    renderAt('/admin')
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })

  it('lets the right role in', async () => {
    localStorage.setItem('buslink.token', 't')
    vi.spyOn(client, 'getMe').mockResolvedValue({ name: 'Olu', role: 'owner', ownerVerified: true })
    for (const fn of ['listBuses', 'listStaff', 'listRoutes', 'listSchedules']) vi.spyOn(owner, fn).mockResolvedValue([])
    renderAt('/owner')
    expect(await screen.findByRole('heading', { name: 'Welcome, Olu' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('logs in and lands on the role dashboard', async () => {
    vi.spyOn(client, 'login').mockResolvedValue({ token: 'abc', user: { name: 'Sam', role: 'staff' } })
    renderAt('/login')
    await userEvent.type(screen.getByLabelText('Email'), 's@x.lk')
    await userEvent.type(screen.getByLabelText('Password'), 'pw')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Verify ticket' })).toBeInTheDocument()
    expect(localStorage.getItem('buslink.token')).toBe('abc')
  })

  it('shows the server error message on failure', async () => {
    vi.spyOn(client, 'login').mockRejectedValue({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password' })
    renderAt('/login')
    await userEvent.type(screen.getByLabelText('Email'), 's@x.lk')
    await userEvent.type(screen.getByLabelText('Password'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled())
  })
})

describe('normalizeError', () => {
  it('maps API errors and network failures to the standard shape', () => {
    const apiErr = { response: { status: 409, data: { error: { code: 'EMAIL_IN_USE', message: 'Email taken' } } } }
    expect(client.normalizeError(apiErr)).toMatchObject({ status: 409, code: 'EMAIL_IN_USE', message: 'Email taken' })
    expect(client.normalizeError(new Error('boom'))).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})
