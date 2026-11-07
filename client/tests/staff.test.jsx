import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AuthProvider } from '../src/app/AuthContext'
import AppRoutes from '../src/app/routes'
import * as client from '../src/api/client'
import * as passenger from '../src/api/passenger'
import * as staff from '../src/api/staff'
import { simulatedPath } from '../src/features/staff/useLocationSharing'

import { todayIso } from '../src/lib/format'

const today = todayIso()
const stops = [
  { id: 's1', name: 'Colombo Fort', order: 0, fareFromStart: 0, location: { lat: 6.93, lng: 79.85 } },
  { id: 's2', name: 'Kandy', order: 1, fareFromStart: 420, location: { lat: 7.29, lng: 80.63 } },
]
const trip = (over = {}) => ({ id: 't1', date: `${today}T00:00:00.000Z`, departureTime: '06:30', status: 'scheduled', route: { id: 'r1', name: 'Colombo – Kandy' }, stops, capacity: 40, takenSeats: [1, 2], ...over })

function renderStaff(path) {
  localStorage.setItem('buslink.token', 't')
  vi.spyOn(client, 'getMe').mockResolvedValue({ id: 'u1', name: 'Kamal', role: 'staff' })
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>)
}

let watchSuccess; let watchError
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn((ok, err) => { watchSuccess = ok; watchError = err; return 7 }), clearWatch: vi.fn() },
  })
})
afterEach(() => vi.useRealTimers())

describe('assigned trips', () => {
  it('groups trips into today and upcoming', async () => {
    vi.spyOn(staff, 'listAssignedTrips').mockResolvedValue([{ _id: 't1' }, { _id: 't2' }])
    vi.spyOn(passenger, 'getTrip').mockImplementation(async (id) => (id === 't1' ? trip() : trip({ id: 't2', date: '2099-01-05T00:00:00.000Z', departureTime: '14:00' })))
    renderStaff('/staff')
    const todaySection = await screen.findByRole('region', { name: 'Today' })
    expect(within(todaySection).getByRole('link')).toHaveAttribute('href', '/staff/trips/t1')
    const upcoming = within(screen.getByRole('region', { name: 'Upcoming' }))
    expect(upcoming.getByText('14:00')).toBeInTheDocument()
    expect(upcoming.getByText('Mon, 5 Jan 2099')).toBeInTheDocument() // date always visible, not truncated with the route
  })

  it('never shows a past-dated trip as upcoming', async () => {
    vi.spyOn(staff, 'listAssignedTrips').mockResolvedValue([{ _id: 't0' }])
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ id: 't0', date: '2000-01-01T00:00:00.000Z' }))
    renderStaff('/staff')
    expect(await screen.findByRole('region', { name: 'Earlier' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Upcoming' })).not.toBeInTheDocument()
  })

  it('explains an empty list', async () => {
    vi.spyOn(staff, 'listAssignedTrips').mockResolvedValue([])
    renderStaff('/staff')
    expect(await screen.findByText('No trips assigned')).toBeInTheDocument()
  })
})

describe('trip control', () => {
  it('starts a scheduled trip only after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValueOnce(trip()).mockResolvedValue(trip({ status: 'active' }))
    vi.spyOn(staff, 'startTrip').mockResolvedValue({})
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByRole('button', { name: 'Start trip' }))
    expect(staff.startTrip).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yes, start now' }))
    expect(staff.startTrip).toHaveBeenCalledWith('t1')
    expect(await screen.findByText(/Passengers have been notified/)).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Location sharing' })).toBeInTheDocument()
  })

  it('ends an active trip after confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValueOnce(trip({ status: 'active' })).mockResolvedValue(trip({ status: 'completed' }))
    vi.spyOn(staff, 'endTrip').mockResolvedValue({})
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByRole('button', { name: 'End trip' }))
    await user.click(screen.getByRole('button', { name: 'Yes, end trip' }))
    expect(staff.endTrip).toHaveBeenCalledWith('t1')
    expect(await screen.findByText(/Trip completed/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Location sharing' })).not.toBeInTheDocument()
  })
})

describe('location sharing', () => {
  it('asks for GPS only when sharing starts, then sends positions', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ status: 'active' }))
    vi.spyOn(staff, 'sendLocation').mockResolvedValue({})
    renderStaff('/staff/trips/t1')
    await screen.findByRole('region', { name: 'Location sharing' })
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Share my location' }))
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled()
    await act(async () => watchSuccess({ coords: { latitude: 6.931, longitude: 79.851, accuracy: 9.6 } }))
    expect(staff.sendLocation).toHaveBeenCalledWith('t1', { lat: 6.931, lng: 79.851, accuracy: 10 })
    expect(await screen.findByText(/Colombo Fort/, { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('± 10 m')).toBeInTheDocument()
  })

  it('throttles updates that arrive too quickly', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ status: 'active' }))
    vi.spyOn(staff, 'sendLocation').mockResolvedValue({})
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByRole('button', { name: 'Share my location' }))
    await act(async () => watchSuccess({ coords: { latitude: 6.931, longitude: 79.851, accuracy: 9 } }))
    await act(async () => watchSuccess({ coords: { latitude: 6.932, longitude: 79.852, accuracy: 9 } }))
    expect(staff.sendLocation).toHaveBeenCalledTimes(1)
  })

  it('explains a denied permission and stops sharing', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ status: 'active' }))
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByRole('button', { name: 'Share my location' }))
    await act(async () => watchError({ code: 1 }))
    expect(screen.getByRole('alert')).toHaveTextContent('Location permission was denied')
    expect(screen.getByRole('button', { name: 'Share my location' })).toBeInTheDocument()
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(7)
  })

  it('stops sharing on the user’s request', async () => {
    const user = userEvent.setup()
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ status: 'active' }))
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByRole('button', { name: 'Share my location' }))
    await user.click(screen.getByRole('button', { name: 'Stop sharing' }))
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(7)
  })

  it('demo mode drives along the route without GPS', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip({ status: 'active' }))
    vi.spyOn(staff, 'sendLocation').mockResolvedValue({})
    renderStaff('/staff/trips/t1')
    await user.click(await screen.findByText('Demo mode (no GPS)'))
    await user.click(screen.getByRole('button', { name: 'Simulate the drive' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(6500) })
    expect(staff.sendLocation.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(staff.sendLocation.mock.calls[0][1]).toEqual({ lat: 6.93, lng: 79.85, accuracy: 15 })
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
  })
})

describe('simulatedPath', () => {
  it('interpolates from the first stop to the last', () => {
    const path = simulatedPath(stops, 4)
    expect(path).toHaveLength(5)
    expect(path[0]).toMatchObject({ lat: 6.93, lng: 79.85 })
    expect(path.at(-1)).toMatchObject({ lat: 7.29, lng: 80.63 })
    expect(path[2].lat).toBeCloseTo(7.11)
  })
})

describe('consistent shell', () => {
  it('uses the shared navigation with Trips and Verify ticket', async () => {
    vi.spyOn(staff, 'listAssignedTrips').mockResolvedValue([])
    renderStaff('/staff')
    await screen.findByRole('heading', { name: 'Your trips' })
    const hrefs = (n) => within(n).getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs(screen.getByRole('navigation', { name: 'Bus staff' }))).toEqual(['/staff', '/staff/verify'])
    expect(hrefs(screen.getByRole('navigation', { name: 'Bus staff quick navigation' }))).toEqual(['/staff', '/staff/verify'])
  })
})
