import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import App from '../src/App.jsx'
import * as client from '../src/api/client'

describe('App', () => {
  it('shows API status when the health call succeeds', async () => {
    vi.spyOn(client, 'getHealth').mockResolvedValue({ data: { status: 'ok', db: 'disconnected' } })
    render(<App />)
    expect(await screen.findByText(/API status: ok/)).toBeInTheDocument()
  })

  it('shows an error when the API is unreachable', async () => {
    vi.spyOn(client, 'getHealth').mockRejectedValue(new Error('down'))
    render(<App />)
    expect(await screen.findByText(/unreachable/)).toBeInTheDocument()
  })
})
