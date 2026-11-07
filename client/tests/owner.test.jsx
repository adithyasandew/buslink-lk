import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/app/AuthContext'
import AppRoutes from '../src/app/routes'
import * as client from '../src/api/client'
import * as owner from '../src/api/owner'

const bus = { _id: 'b1', registrationNumber: 'NB-1234', model: 'Leyland', capacity: 52, status: 'pending' }
const route = { _id: 'r1', name: 'Colombo – Kandy', startPoint: 'Colombo', destination: 'Kandy', assignedBusIds: ['b1'] }
const stopsFromApi = [
  { name: 'Colombo', location: { lat: 6.93, lng: 79.86 }, fareFromStart: 0 },
  { name: 'Kandy', location: { lat: 7.29, lng: 80.63 }, fareFromStart: 400 },
]
const user = userEvent.setup()

function renderOwner(path) {
  localStorage.setItem('buslink.token', 't')
  vi.spyOn(client, 'getMe').mockResolvedValue({ name: 'Olu', role: 'owner', ownerVerified: false })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><AppRoutes /></AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  for (const fn of ['listBuses', 'listStaff', 'listRoutes', 'listSchedules']) vi.spyOn(owner, fn).mockResolvedValue([])
})

describe('owner navigation and dashboard', () => {
  it('shows counts, a verification notice and the owner nav', async () => {
    owner.listBuses.mockResolvedValue([bus])
    renderOwner('/owner')
    expect(await screen.findByRole('heading', { name: 'Welcome, Olu' })).toBeInTheDocument()
    expect(await screen.findByText(/awaiting verification/)).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Bus owner' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Buses', 'Staff', 'Routes', 'Schedules'])
  })

  it('shows a retryable error when loading fails', async () => {
    owner.listBuses.mockRejectedValue({ message: 'Network down' })
    renderOwner('/owner')
    expect(await screen.findByText('Network down')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('buses page', () => {
  it('shows an empty state with a call to action', async () => {
    renderOwner('/owner/buses')
    expect(await screen.findByText('No buses yet')).toBeInTheDocument()
  })

  it('lists buses with status as text', async () => {
    owner.listBuses.mockResolvedValue([bus])
    renderOwner('/owner/buses')
    expect((await screen.findAllByText('NB-1234')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
  })

  it('validates before calling the API, then registers a bus', async () => {
    vi.spyOn(owner, 'createBus').mockResolvedValue(bus)
    renderOwner('/owner/buses')
    await user.click(await screen.findByRole('button', { name: 'Register your first bus' }))
    await user.click(screen.getByRole('button', { name: 'Register bus' }))
    expect(await screen.findByText(/Enter 3 to 20 characters/)).toBeInTheDocument()
    expect(owner.createBus).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Registration number'), 'nb-1234')
    await user.type(screen.getByLabelText('Seats'), '52')
    await user.click(screen.getByRole('button', { name: 'Register bus' }))
    expect(owner.createBus).toHaveBeenCalledWith({ registrationNumber: 'nb-1234', model: undefined, capacity: 52 })
    expect(await screen.findByText('Bus saved')).toBeInTheDocument()
  })

  it('shows a server conflict message and keeps the input', async () => {
    vi.spyOn(owner, 'createBus').mockRejectedValue({ message: 'A bus with this registration number already exists', details: [] })
    renderOwner('/owner/buses')
    await user.click(await screen.findByRole('button', { name: 'Register your first bus' }))
    await user.type(screen.getByLabelText('Registration number'), 'NB-1234')
    await user.type(screen.getByLabelText('Seats'), '40')
    await user.click(screen.getByRole('button', { name: 'Register bus' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(screen.getByLabelText('Registration number')).toHaveValue('NB-1234')
  })

  it('needs a confirmation step before deactivating', async () => {
    owner.listBuses.mockResolvedValue([bus])
    vi.spyOn(owner, 'deactivateBus').mockResolvedValue({ ...bus, status: 'inactive' })
    renderOwner('/owner/buses')
    await screen.findAllByText('NB-1234')
    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    expect(owner.deactivateBus).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole('button', { name: 'Confirm' })[0])
    expect(owner.deactivateBus).toHaveBeenCalledWith('b1')
  })
})

describe('staff page', () => {
  it('validates and creates a staff member', async () => {
    vi.spyOn(owner, 'createStaff').mockResolvedValue({})
    renderOwner('/owner/staff')
    await user.click(await screen.findByRole('button', { name: 'Add staff' }))
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Full name'), 'Kamal Perera')
    await user.type(screen.getByLabelText('Email'), 'kamal@example.lk')
    await user.type(screen.getByLabelText('Temporary password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Add staff' }))
    expect(owner.createStaff).toHaveBeenCalledWith({ name: 'Kamal Perera', email: 'kamal@example.lk', password: 'password123', phone: undefined })
  })

  it('assigns the selected staff member to the selected bus', async () => {
    owner.listStaff.mockResolvedValue([{ id: 's1', name: 'Kamal', email: 'k@x.lk' }])
    owner.listBuses.mockResolvedValue([bus])
    vi.spyOn(owner, 'assignStaff').mockResolvedValue({})
    renderOwner('/owner/staff')
    const panel = await screen.findByRole('region', { name: 'Assign staff to a bus' })
    await user.selectOptions(within(panel).getByLabelText('Staff member'), 's1')
    await user.selectOptions(within(panel).getByLabelText('Bus'), 'b1')
    await user.selectOptions(within(panel).getByLabelText('Role on the bus'), 'conductor')
    await user.click(within(panel).getByRole('button', { name: 'Assign' }))
    expect(owner.assignStaff).toHaveBeenCalledWith('b1', { staffUserId: 's1', staffType: 'conductor' })
    expect(await screen.findByText('Staff assigned to bus')).toBeInTheDocument()
  })
})

describe('routes and stops', () => {
  it('lists routes with assigned bus counts and links to detail', async () => {
    owner.listRoutes.mockResolvedValue([route])
    renderOwner('/owner/routes')
    const link = await screen.findByRole('link', { name: /Colombo – Kandy/ })
    expect(link).toHaveAttribute('href', '/owner/routes/r1')
    expect(link).toHaveTextContent('1 bus assigned')
  })

  it('creates a route after validation', async () => {
    vi.spyOn(owner, 'createRoute').mockResolvedValue(route)
    renderOwner('/owner/routes')
    await user.click(await screen.findByRole('button', { name: 'Create your first route' }))
    await user.click(screen.getByRole('button', { name: 'Create route' }))
    expect(await screen.findByText(/Enter a route name/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Route name'), 'Colombo – Kandy')
    await user.type(screen.getByLabelText('Starting point'), 'Colombo')
    await user.type(screen.getByLabelText('Destination'), 'Kandy')
    await user.click(screen.getByRole('button', { name: 'Create route' }))
    expect(owner.createRoute).toHaveBeenCalledWith({ name: 'Colombo – Kandy', startPoint: 'Colombo', destination: 'Kandy' })
  })

  function mockDetail() {
    vi.spyOn(owner, 'getRoute').mockResolvedValue({ ...route, stops: stopsFromApi })
    owner.listBuses.mockResolvedValue([bus, { ...bus, _id: 'b2', registrationNumber: 'NB-9999' }])
  }

  it('prevents saving stops with a decreasing fare, then saves numeric values', async () => {
    mockDetail()
    vi.spyOn(owner, 'saveStops').mockResolvedValue([])
    renderOwner('/owner/routes/r1')
    const stop2 = await screen.findByRole('listitem', { name: 'Stop 2' })
    const fare = within(stop2).getByLabelText('Fare from start (Rs.)')
    await user.clear(fare)
    await user.type(fare, '-5')
    await user.click(screen.getByRole('button', { name: 'Save stops' }))
    expect(await screen.findByText(/Enter a fare of 0 or more/)).toBeInTheDocument()
    expect(owner.saveStops).not.toHaveBeenCalled()
    await user.clear(fare)
    await user.type(fare, '450')
    await user.click(screen.getByRole('button', { name: 'Save stops' }))
    expect(owner.saveStops).toHaveBeenCalledWith('r1', [
      { name: 'Colombo', lat: 6.93, lng: 79.86, fareFromStart: 0 },
      { name: 'Kandy', lat: 7.29, lng: 80.63, fareFromStart: 450 },
    ])
  })

  it('keeps at least two stops, supports reordering, and assigns another bus', async () => {
    mockDetail()
    vi.spyOn(owner, 'assignBusToRoute').mockResolvedValue({})
    renderOwner('/owner/routes/r1')
    await screen.findByRole('listitem', { name: 'Stop 1' })
    expect(screen.getByRole('button', { name: 'Remove stop 1' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move stop 1 down' }))
    expect(within(screen.getByRole('listitem', { name: 'Stop 1' })).getByLabelText('Name')).toHaveValue('Kandy')
    await user.selectOptions(screen.getByLabelText('Assign a bus'), 'b2')
    await user.click(screen.getByRole('button', { name: 'Assign bus' }))
    expect(owner.assignBusToRoute).toHaveBeenCalledWith('r1', 'b2')
  })

  it('needs two clicks to delete a route', async () => {
    mockDetail()
    vi.spyOn(owner, 'deleteRoute').mockResolvedValue({})
    renderOwner('/owner/routes/r1')
    await user.click(await screen.findByRole('button', { name: 'Delete route' }))
    expect(owner.deleteRoute).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(owner.deleteRoute).toHaveBeenCalledWith('r1')
  })
})

describe('schedules page', () => {
  const schedule = { _id: 'sc1', busId: 'b1', routeId: 'r1', departureTime: '06:30', arrivalTime: '10:00', operatingDays: [1, 3, 5], active: true }

  it('requires a bus, route, times and at least one day', async () => {
    owner.listBuses.mockResolvedValue([bus])
    owner.listRoutes.mockResolvedValue([route])
    vi.spyOn(owner, 'createSchedule').mockResolvedValue(schedule)
    renderOwner('/owner/schedules')
    await user.click(await screen.findByRole('button', { name: 'Create a schedule' }))
    await user.click(screen.getByRole('button', { name: 'Create schedule' }))
    expect(await screen.findByText('Choose at least one operating day')).toBeInTheDocument()
    expect(owner.createSchedule).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Bus'), 'b1')
    await user.selectOptions(screen.getByLabelText('Route'), 'r1')
    await user.type(screen.getByLabelText('Departure time'), '06:30')
    await user.type(screen.getByLabelText('Arrival time'), '10:00')
    await user.click(screen.getByLabelText('Mon'))
    await user.click(screen.getByLabelText('Wed'))
    await user.click(screen.getByRole('button', { name: 'Create schedule' }))
    expect(owner.createSchedule).toHaveBeenCalledWith({ busId: 'b1', routeId: 'r1', departureTime: '06:30', arrivalTime: '10:00', operatingDays: [1, 3] })
  })

  it('lists schedules with readable names and generates trips', async () => {
    owner.listBuses.mockResolvedValue([bus])
    owner.listRoutes.mockResolvedValue([route])
    owner.listSchedules.mockResolvedValue([schedule])
    vi.spyOn(owner, 'generateTrips').mockResolvedValue({ created: ['2026-11-09', '2026-11-11'] })
    renderOwner('/owner/schedules')
    expect((await screen.findAllByText('Colombo – Kandy')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mon, Wed, Fri').length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Generate trips' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Generate trips' }).at(-1))
    expect(owner.generateTrips).toHaveBeenCalledWith('sc1', expect.objectContaining({ from: expect.any(String), to: expect.any(String) }))
    expect(await screen.findByText(/Created 2 trip\(s\)/)).toBeInTheDocument()
  })
})

describe('modern shell: navigation and setup checklist', () => {
  it('provides a sidebar and a mobile bottom nav with the same destinations', async () => {
    renderOwner('/owner')
    await screen.findByRole('heading', { name: 'Welcome, Olu' })
    const side = screen.getByRole('navigation', { name: 'Bus owner' })
    const bottom = screen.getByRole('navigation', { name: 'Bus owner quick navigation' })
    const hrefs = (nav) => within(nav).getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs(bottom)).toEqual(hrefs(side))
    expect(within(bottom).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows setup progress and marks completed steps', async () => {
    owner.listBuses.mockResolvedValue([bus])
    owner.listRoutes.mockResolvedValue([route])
    renderOwner('/owner')
    const bar = await screen.findByRole('progressbar', { name: 'Setup progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    expect(screen.getByText('2 of 4 done')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Register a bus.*\(done\)/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Add a driver or conductor.*\(to do\)/ })).toBeInTheDocument()
  })

  it('hides the checklist once setup is complete', async () => {
    owner.listBuses.mockResolvedValue([bus])
    owner.listRoutes.mockResolvedValue([route])
    owner.listStaff.mockResolvedValue([{ id: 's1', name: 'K' }])
    owner.listSchedules.mockResolvedValue([{ _id: 'sc', busId: 'b1', routeId: 'r1', operatingDays: [1], active: true }])
    renderOwner('/owner')
    await screen.findByRole('heading', { name: 'Welcome, Olu' })
    await screen.findByRole('link', { name: /1.*Buses/ }) // stats tiles rendered
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('announces loading to assistive tech with a skeleton', async () => {
    owner.listBuses.mockReturnValue(new Promise(() => {}))
    renderOwner('/owner/buses')
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
  })
})
