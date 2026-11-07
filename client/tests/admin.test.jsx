import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/app/AuthContext'
import AppRoutes from '../src/app/routes'
import * as client from '../src/api/client'
import * as admin from '../src/api/admin'

const user = userEvent.setup()
const me = { id: 'a1', name: 'Site Admin', role: 'admin' }
const pendingBus = { _id: 'b1', registrationNumber: 'NB-9999', capacity: 40, status: 'pending', owner: { id: 'o1', name: 'Sunil', email: 's@x.lk', verified: false } }

function renderAdmin(path) {
  localStorage.setItem('buslink.token', 't')
  vi.spyOn(client, 'getMe').mockResolvedValue(me)
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('admin overview', () => {
  it('highlights what needs attention and shows the rating', async () => {
    vi.spyOn(admin, 'getOverview').mockResolvedValue({ usersByRole: { passenger: 7, owner: 2, admin: 1 }, busesByStatus: { pending: 3, active: 1 }, openComplaints: 2, bookings: 15 })
    vi.spyOn(admin, 'listRatings').mockResolvedValue({ items: [], meta: { count: 4, average: 4.3 } })
    renderAdmin('/admin')
    expect(await screen.findByRole('link', { name: /3.*Buses awaiting verification/ })).toHaveAttribute('href', '/admin/buses')
    expect(screen.getByRole('link', { name: /2.*Open complaints/ })).toHaveAttribute('href', '/admin/complaints')
    expect(screen.getByRole('link', { name: /10.*Users/ })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Service rating' })).getByText('4.3')).toBeInTheDocument()
  })
})

describe('bus verification', () => {
  it('shows the pending queue with the owner and verifies a bus', async () => {
    vi.spyOn(admin, 'listAllBuses').mockResolvedValue({ items: [pendingBus], meta: { page: 1, limit: 20, total: 1 } })
    vi.spyOn(admin, 'verifyBus').mockResolvedValue({})
    renderAdmin('/admin/buses')
    expect(await screen.findAllByText('owner not verified')).not.toHaveLength(0)
    expect(admin.listAllBuses).toHaveBeenCalledWith({ status: 'pending', page: 1 })
    await user.click(screen.getAllByRole('button', { name: 'Verify NB-9999' })[0])
    expect(admin.verifyBus).toHaveBeenCalledWith('b1', true)
    expect(await screen.findByText(/NB-9999 verified/)).toBeInTheDocument()
  })

  it('filters by status and needs confirmation to revoke', async () => {
    vi.spyOn(admin, 'listAllBuses').mockResolvedValue({ items: [{ ...pendingBus, status: 'verified' }], meta: { page: 1, limit: 20, total: 1 } })
    vi.spyOn(admin, 'verifyBus').mockResolvedValue({})
    renderAdmin('/admin/buses')
    await user.click(await screen.findByRole('radio', { name: 'Verified' }))
    expect(admin.listAllBuses).toHaveBeenLastCalledWith({ status: 'verified', page: 1 })
    await user.click((await screen.findAllByRole('button', { name: 'Revoke' }))[0])
    expect(admin.verifyBus).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole('button', { name: 'Yes, revoke' })[0])
    expect(admin.verifyBus).toHaveBeenCalledWith('b1', false)
  })

  it('pages through long lists', async () => {
    vi.spyOn(admin, 'listAllBuses').mockResolvedValue({ items: [pendingBus], meta: { page: 1, limit: 20, total: 45 } })
    renderAdmin('/admin/buses')
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(admin.listAllBuses).toHaveBeenLastCalledWith({ status: 'pending', page: 2 })
  })
})

describe('users', () => {
  const users = [
    { id: 'a1', name: 'Site Admin', email: 'a@x.lk', role: 'admin', status: 'active' },
    { id: 'o1', name: 'Sunil', email: 's@x.lk', role: 'owner', status: 'active', ownerVerified: false },
    { id: 'p1', name: 'Asha', email: 'p@x.lk', role: 'passenger', status: 'suspended' },
  ]

  it('never offers actions on the admin’s own account', async () => {
    vi.spyOn(admin, 'listUsers').mockResolvedValue({ items: users, meta: { page: 1, limit: 20, total: 3 } })
    renderAdmin('/admin/users')
    expect((await screen.findAllByText('This is you')).length).toBeGreaterThan(0)
  })

  it('verifies an owner, suspends with confirmation and reactivates', async () => {
    vi.spyOn(admin, 'listUsers').mockResolvedValue({ items: users, meta: { page: 1, limit: 20, total: 3 } })
    vi.spyOn(admin, 'verifyOwner').mockResolvedValue({})
    vi.spyOn(admin, 'updateUser').mockResolvedValue({})
    renderAdmin('/admin/users')
    await user.click((await screen.findAllByRole('button', { name: 'Verify owner Sunil' }))[0])
    expect(admin.verifyOwner).toHaveBeenCalledWith('o1', true)
    await user.click(screen.getAllByRole('button', { name: 'Suspend' })[0])
    expect(admin.updateUser).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole('button', { name: 'Yes, suspend' })[0])
    expect(admin.updateUser).toHaveBeenCalledWith('o1', { status: 'suspended' })
    await user.click(screen.getAllByRole('button', { name: 'Reactivate Asha' })[0])
    expect(admin.updateUser).toHaveBeenCalledWith('p1', { status: 'active' })
  })

  it('filters by role', async () => {
    vi.spyOn(admin, 'listUsers').mockResolvedValue({ items: users, meta: { page: 1, limit: 20, total: 3 } })
    renderAdmin('/admin/users')
    await user.click(await screen.findByRole('radio', { name: 'Owners' }))
    expect(admin.listUsers).toHaveBeenLastCalledWith({ role: 'owner', page: 1 })
  })
})

describe('complaints', () => {
  it('only offers the allowed next steps and reports the result', async () => {
    vi.spyOn(admin, 'listComplaints').mockResolvedValue([{ _id: 'c1', status: 'open', details: 'Driver was speeding.', createdAt: new Date().toISOString() }])
    vi.spyOn(admin, 'updateComplaint').mockResolvedValue({})
    renderAdmin('/admin/complaints')
    expect(await screen.findByText('Driver was speeding.')).toBeInTheDocument()
    expect(admin.listComplaints).toHaveBeenCalledWith({ status: 'open' })
    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start review' }))
    expect(admin.updateComplaint).toHaveBeenCalledWith('c1', 'in_review')
    expect(await screen.findByText(/marked in review\. The passenger has been notified/)).toBeInTheDocument()
  })

  it('offers resolve for complaints in review', async () => {
    vi.spyOn(admin, 'listComplaints').mockResolvedValue([{ _id: 'c2', status: 'in_review', details: 'Late bus.', createdAt: new Date().toISOString() }])
    vi.spyOn(admin, 'updateComplaint').mockResolvedValue({})
    renderAdmin('/admin/complaints')
    await user.click(await screen.findByRole('button', { name: 'Mark resolved' }))
    expect(admin.updateComplaint).toHaveBeenCalledWith('c2', 'resolved')
  })
})

describe('ratings', () => {
  it('shows the average and readable star ratings', async () => {
    vi.spyOn(admin, 'listRatings').mockResolvedValue({ items: [{ _id: 'r1', rating: 4, feedback: 'Clean bus', createdAt: new Date().toISOString() }], meta: { count: 1, average: 4 } })
    renderAdmin('/admin/ratings')
    expect(await screen.findByLabelText('4 out of 5 stars')).toBeInTheDocument()
    expect(screen.getByText('Clean bus')).toBeInTheDocument()
  })
})

describe('consistent shell', () => {
  it('uses the shared sidebar and bottom navigation', async () => {
    vi.spyOn(admin, 'getOverview').mockResolvedValue({ usersByRole: {}, busesByStatus: {}, openComplaints: 0, bookings: 0 })
    vi.spyOn(admin, 'listRatings').mockResolvedValue({ items: [], meta: { count: 0, average: null } })
    renderAdmin('/admin')
    await screen.findByRole('heading', { name: 'Administration' })
    const hrefs = (n) => within(n).getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs(screen.getByRole('navigation', { name: 'Administrator' }))).toEqual(['/admin', '/admin/buses', '/admin/users', '/admin/complaints', '/admin/ratings'])
    expect(hrefs(screen.getByRole('navigation', { name: 'Administrator quick navigation' }))).toHaveLength(5)
  })
})
