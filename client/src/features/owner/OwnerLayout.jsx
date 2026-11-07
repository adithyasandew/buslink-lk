import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  { to: '/owner', label: 'Overview', end: true },
  { to: '/owner/buses', label: 'Buses' },
  { to: '/owner/staff', label: 'Staff' },
  { to: '/owner/routes', label: 'Routes' },
  { to: '/owner/schedules', label: 'Schedules' },
]

const link = ({ isActive }) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium ${
    isActive ? 'bg-primary text-white' : 'text-muted hover:bg-surface'
  }`

export default function OwnerLayout() {
  return (
    <div>
      {/* Scrolls horizontally on narrow screens instead of wrapping or overflowing the page */}
      <nav aria-label="Bus owner" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-1">
          {LINKS.map((l) => (
            <li key={l.to}><NavLink to={l.to} end={l.end} className={link}>{l.label}</NavLink></li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}
