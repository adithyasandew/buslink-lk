import { NavLink, Outlet } from 'react-router-dom'
import Icon from '../../components/ui/Icon'

const LINKS = [
  { to: '/owner', label: 'Overview', icon: 'home', end: true },
  { to: '/owner/buses', label: 'Buses', icon: 'bus' },
  { to: '/owner/staff', label: 'Staff', icon: 'users' },
  { to: '/owner/routes', label: 'Routes', icon: 'route' },
  { to: '/owner/schedules', label: 'Schedules', icon: 'calendar' },
]

const side = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface hover:text-text'
  }`
const tab = ({ isActive }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-primary' : 'text-muted'}`

/** Sidebar on large screens; an app-style bottom tab bar on phones and tablets. */
export default function OwnerLayout() {
  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Bus owner" className="hidden lg:block">
        <ul className="sticky top-24 space-y-1">
          {LINKS.map((l) => (
            <li key={l.to}><NavLink to={l.to} end={l.end} className={side}><Icon name={l.icon} />{l.label}</NavLink></li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 pb-20 lg:pb-0">
        <Outlet />
      </div>

      <nav aria-label="Bus owner quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-xl">
          {LINKS.map((l) => (
            <li key={l.to} className="flex flex-1">
              <NavLink to={l.to} end={l.end} className={tab}><Icon name={l.icon} />{l.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
