import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/app/AuthContext'
import AppRoutes from '../src/app/routes'
import * as client from '../src/api/client'
import * as passenger from '../src/api/passenger'
import * as staff from '../src/api/staff'

vi.mock('../src/components/MapView', () => ({ default: ({ bus }) => <div data-testid="map">{bus ? `bus at ${bus.lat},${bus.lng}` : 'no bus'}</div> }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') } }))
const socket = { handlers: {}, on(ev, fn) { this.handlers[ev] = fn; return this }, emit: vi.fn(), close: vi.fn() }
vi.mock('../src/api/socket', () => ({ connectSocket: () => socket }))

const user = userEvent.setup()
const stops = [
  { id: 's1', name: 'Colombo Fort', order: 0, fareFromStart: 0, location: { lat: 6.93, lng: 79.85 } },
  { id: 's2', name: 'Kegalle', order: 1, fareFromStart: 260, location: { lat: 7.25, lng: 80.35 } },
  { id: 's3', name: 'Kandy', order: 2, fareFromStart: 420, location: { lat: 7.29, lng: 80.63 } },
]
const trip = { id: 't1', date: '2026-11-09T00:00:00.000Z', departureTime: '06:30', status: 'scheduled', route: { id: 'r1', name: 'Colombo – Kandy' }, stops, capacity: 8, takenSeats: [2, 5] }
const booking = { _id: 'b1', tripId: 't1', pickupStopId: 's1', dropoffStopId: 's3', seats: [3], fare: 420, status: 'pending', approachDistanceMeters: 500 }

function renderAs(role, path) {
  localStorage.setItem('buslink.token', 't')
  vi.spyOn(client, 'getMe').mockResolvedValue({ name: 'Asha', role })
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  socket.handlers = {}
  vi.spyOn(passenger, 'getTrip').mockResolvedValue(trip)
})

describe('search', () => {
  it('validates, searches and links each result to its seat map', async () => {
    vi.spyOn(passenger, 'searchTrips').mockResolvedValue([{ tripId: 't1', route: 'Colombo – Kandy', departureTime: '06:30', fare: 420, seatsAvailable: 6, pickupStopId: 's1', dropoffStopId: 's3' }])
    renderAs('passenger', '/passenger')
    await user.click(await screen.findByRole('button', { name: /Search buses/ }))
    expect(await screen.findByText('Enter where you are starting from')).toBeInTheDocument()
    expect(passenger.searchTrips).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('From'), 'Colombo Fort')
    await user.type(screen.getByLabelText('To'), 'Kandy')
    await user.click(screen.getByRole('button', { name: /Search buses/ }))
    const result = await screen.findByRole('link', { name: /06:30 Colombo – Kandy, Rs\. 420, 6 seats left/ })
    expect(result).toHaveAttribute('href', '/passenger/trips/t1?pickup=s1&dropoff=s3')
    expect(passenger.searchTrips).toHaveBeenCalledWith(expect.objectContaining({ from: 'Colombo Fort', to: 'Kandy' }))
  })

  it('swaps from and to, and explains when nothing is found', async () => {
    vi.spyOn(passenger, 'searchTrips').mockResolvedValue([])
    renderAs('passenger', '/passenger')
    await user.type(await screen.findByLabelText('From'), 'Kandy')
    await user.type(screen.getByLabelText('To'), 'Colombo Fort')
    await user.click(screen.getByRole('button', { name: 'Swap from and to' }))
    expect(screen.getByLabelText('From')).toHaveValue('Colombo Fort')
    await user.click(screen.getByRole('button', { name: /Search buses/ }))
    expect(await screen.findByText('No buses found')).toBeInTheDocument()
  })
})

describe('trip page and seat map', () => {
  it('shows booked seats as unavailable, updates the summary and books', async () => {
    vi.spyOn(passenger, 'createBooking').mockResolvedValue({ ...booking })
    vi.spyOn(passenger, 'getBooking').mockResolvedValue({ ...booking })
    renderAs('passenger', '/passenger/trips/t1?pickup=s1&dropoff=s3')
    expect(await screen.findByRole('button', { name: 'Seat 2, booked' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Seat 3' }))
    await user.click(screen.getByRole('button', { name: 'Seat 4' }))
    expect(screen.getByRole('button', { name: 'Seat 3, selected' })).toHaveAttribute('aria-pressed', 'true')
    const summary = screen.getByRole('complementary', { name: 'Booking summary' })
    expect(within(summary).getByText('3, 4')).toBeInTheDocument()
    expect(within(summary).getByText('Rs. 840')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Book 2 seats' }))
    expect(passenger.createBooking).toHaveBeenCalledWith({ tripId: 't1', pickupStopId: 's1', dropoffStopId: 's3', seats: [3, 4] })
    // Wait for something only the booking page has; the trip page shares the route heading and may still be unmounting.
    expect(await screen.findByRole('region', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Booking details' })).toBeInTheDocument()
  })

  it('blocks a drop-off before the pickup', async () => {
    renderAs('passenger', '/passenger/trips/t1?pickup=s3&dropoff=s2')
    expect(await screen.findByText('Drop-off must come after pickup')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seat 1' }))
    expect(screen.getByRole('button', { name: 'Book 1 seat' })).toBeDisabled()
  })

  it('explains a seat that was taken meanwhile and refreshes the map', async () => {
    vi.spyOn(passenger, 'createBooking').mockRejectedValue({ code: 'BOOKING_SEAT_TAKEN', message: 'taken' })
    renderAs('passenger', '/passenger/trips/t1?pickup=s1&dropoff=s3')
    await user.click(await screen.findByRole('button', { name: 'Seat 1' }))
    await user.click(screen.getByRole('button', { name: 'Book 1 seat' }))
    expect(await screen.findByText(/Someone just booked one of those seats/)).toBeInTheDocument()
    expect(passenger.getTrip).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Seat 1' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('booking, payment and cancellation', () => {
  it('pays a pending booking with the chosen method', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue({ ...booking })
    vi.spyOn(passenger, 'payBooking').mockResolvedValue({ payment: { status: 'success' } })
    renderAs('passenger', '/passenger/bookings/b1')
    const pay = await screen.findByRole('region', { name: 'Payment' })
    expect(within(pay).getByText(/no real money/)).toBeInTheDocument()
    await user.selectOptions(within(pay).getByLabelText('Payment method'), 'mock_wallet')
    await user.click(within(pay).getByRole('button', { name: 'Pay Rs. 420' }))
    expect(passenger.payBooking).toHaveBeenCalledWith({ bookingId: 'b1', method: 'mock_wallet', simulate: 'success' })
    expect(await screen.findByText(/your ticket is ready/)).toBeInTheDocument()
  })

  it('reports a declined payment without leaving the page', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue({ ...booking })
    vi.spyOn(passenger, 'payBooking').mockResolvedValue({ payment: { status: 'failed' } })
    renderAs('passenger', '/passenger/bookings/b1')
    await user.click(await screen.findByRole('button', { name: 'Pay Rs. 420' }))
    expect(await screen.findByText(/payment failed/)).toBeInTheDocument()
  })

  it('offers ticket and tracking for a confirmed booking and shows the refund on cancel', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue({ ...booking, status: 'confirmed', ticketId: 'tk1' })
    vi.spyOn(passenger, 'cancelBooking').mockResolvedValue({ ...booking, status: 'cancelled', refund: { amount: 420, status: 'refunded' } })
    renderAs('passenger', '/passenger/bookings/b1')
    expect(await screen.findByRole('link', { name: 'View ticket' })).toHaveAttribute('href', '/passenger/tickets/tk1')
    expect(screen.getByRole('link', { name: 'Track bus' })).toHaveAttribute('href', '/passenger/bookings/b1/track')
    expect(screen.queryByRole('region', { name: 'Payment' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }))
    expect(passenger.cancelBooking).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    expect(await screen.findByText('Booking cancelled. Rs. 420 has been refunded.')).toBeInTheDocument()
  })

  it('lists bookings with route, date and status', async () => {
    vi.spyOn(passenger, 'listBookings').mockResolvedValue([{ ...booking, status: 'confirmed' }])
    renderAs('passenger', '/passenger/bookings')
    const item = await screen.findByRole('link', { name: /Colombo – Kandy/ })
    expect(item).toHaveTextContent('confirmed')
    expect(item).toHaveTextContent('Seat 3')
    expect(item).toHaveAttribute('href', '/passenger/bookings/b1')
  })
})

describe('ticket', () => {
  const ticket = { _id: 'tk1', ticketRef: 'BL-ABCDEF1234', qrToken: 'f'.repeat(48), status: 'valid', fare: 420, seats: [3], tripId: 't1' }

  it('shows the QR code with a readable reference', async () => {
    vi.spyOn(passenger, 'getTicket').mockResolvedValue(ticket)
    renderAs('passenger', '/passenger/tickets/tk1')
    expect(await screen.findByRole('img', { name: 'QR code for ticket BL-ABCDEF1234' })).toHaveAttribute('src', 'data:image/png;base64,QR')
    expect(screen.getByText('BL-ABCDEF1234')).toBeInTheDocument()
  })

  it('hides the QR code once the ticket is used', async () => {
    vi.spyOn(passenger, 'getTicket').mockResolvedValue({ ...ticket, status: 'used' })
    renderAs('passenger', '/passenger/tickets/tk1')
    expect(await screen.findByText('This ticket is used')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('live tracking', () => {
  const confirmed = { ...booking, status: 'confirmed' }

  it('joins the trip room and updates the map and text from live events', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue(confirmed)
    vi.spyOn(passenger, 'getTripLocation').mockResolvedValue({ tripStatus: 'active', location: null })
    renderAs('passenger', '/passenger/bookings/b1/track')
    expect(await screen.findByText(/No location has been shared yet/)).toBeInTheDocument()
    // The socket subscribes in an effect after render; wait for it before simulating events.
    await waitFor(() => expect(socket.handlers['location:updated']).toBeTypeOf('function'))
    act(() => socket.handlers.connect())
    expect(socket.emit).toHaveBeenCalledWith('trip:join', { tripId: 't1' })
    act(() => socket.handlers['location:updated']({ tripId: 't1', lat: 7.25, lng: 80.35, recordedAt: new Date().toISOString() }))
    expect(screen.getByTestId('map')).toHaveTextContent('bus at 7.25,80.35')
    expect(screen.getByText(/Kegalle/)).toBeInTheDocument()
    act(() => socket.handlers['bus:approaching']({ tripId: 't1', distanceMeters: 300 }))
    expect(screen.getByText(/Your bus is about 300 m away/)).toBeInTheDocument()
  })

  it('warns when the last location is stale', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue(confirmed)
    vi.spyOn(passenger, 'getTripLocation').mockResolvedValue({ tripStatus: 'active', location: { lat: 7, lng: 80, recordedAt: new Date(Date.now() - 10 * 60000).toISOString() } })
    renderAs('passenger', '/passenger/bookings/b1/track')
    expect(await screen.findByText(/may be out of date/)).toBeInTheDocument()
  })

  it('saves the approach alert distance for the pickup stop', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue(confirmed)
    vi.spyOn(passenger, 'getTripLocation').mockResolvedValue({ tripStatus: 'scheduled', location: null })
    vi.spyOn(passenger, 'setPickupPoint').mockResolvedValue({})
    renderAs('passenger', '/passenger/bookings/b1/track')
    await user.selectOptions(await screen.findByLabelText('Alert me when the bus is within'), '1000')
    await user.click(screen.getByRole('button', { name: 'Use my pickup stop' }))
    expect(passenger.setPickupPoint).toHaveBeenCalledWith('b1', { lat: 6.93, lng: 79.85, approachDistanceMeters: 1000 })
    expect(await screen.findByText(/within 1.0 km/)).toBeInTheDocument()
  })

  it('is only available for confirmed bookings', async () => {
    vi.spyOn(passenger, 'getBooking').mockResolvedValue(booking)
    vi.spyOn(passenger, 'getTripLocation').mockResolvedValue(null)
    renderAs('passenger', '/passenger/bookings/b1/track')
    expect(await screen.findByText(/available once your booking is confirmed/)).toBeInTheDocument()
  })
})

describe('notifications', () => {
  it('lists alerts and marks one as read', async () => {
    vi.spyOn(passenger, 'listNotifications').mockResolvedValue([{ _id: 'n1', type: 'bus_approaching', message: 'Your bus is about 300 m away.', status: 'unread', createdAt: new Date().toISOString() }])
    vi.spyOn(passenger, 'markNotificationRead').mockResolvedValue({})
    renderAs('passenger', '/passenger/notifications')
    await user.click(await screen.findByRole('button', { name: 'Mark as read: Your bus is about 300 m away.' }))
    expect(passenger.markNotificationRead).toHaveBeenCalledWith('n1')
    expect(screen.queryByRole('button', { name: /Mark as read/ })).not.toBeInTheDocument()
  })
})

describe('staff ticket verification', () => {
  it('shows a clear pass for a valid ticket', async () => {
    vi.spyOn(staff, 'verifyTicket').mockResolvedValue({ ticketRef: 'BL-ABCDEF1234', seats: [3, 4], status: 'used' })
    renderAs('staff', '/staff/verify')
    await user.type(await screen.findByLabelText('Ticket code'), 'abc123token')
    await user.click(screen.getByRole('button', { name: 'Check ticket' }))
    expect(staff.verifyTicket).toHaveBeenCalledWith('abc123token')
    expect(await screen.findByText(/Valid — let them board/)).toBeInTheDocument()
    expect(screen.getByText('Seats 3, 4')).toBeInTheDocument()
  })

  it('explains a replayed ticket in plain words', async () => {
    vi.spyOn(staff, 'verifyTicket').mockRejectedValue({ code: 'TICKET_ALREADY_USED', message: 'used' })
    renderAs('staff', '/staff/verify')
    await user.type(await screen.findByLabelText('Ticket code'), 'abc123token')
    await user.click(screen.getByRole('button', { name: 'Check ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already used')
  })
})

describe('consistent shell', () => {
  it('passenger and staff areas use the same sidebar and bottom navigation pattern as the owner area', async () => {
    vi.spyOn(passenger, 'searchTrips').mockResolvedValue([])
    renderAs('passenger', '/passenger')
    await screen.findByRole('heading', { name: 'Find a bus' })
    const side = screen.getByRole('navigation', { name: 'Passenger' })
    const bottom = screen.getByRole('navigation', { name: 'Passenger quick navigation' })
    const hrefs = (n) => within(n).getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs(side)).toEqual(['/passenger', '/passenger/bookings', '/passenger/notifications'])
    expect(hrefs(bottom)).toEqual(hrefs(side))
  })
})
