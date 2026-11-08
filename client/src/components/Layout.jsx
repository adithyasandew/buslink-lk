import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'
import Icon from './ui/Icon'

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2.5 font-bold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Icon name="bus" className="size-5" /></span>
            <span className="text-lg">BusLink <span className="text-primary">LK</span></span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to={homeFor(user)} className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted hover:bg-background sm:inline-flex">Dashboard</Link>
                <span className="flex items-center gap-2" title={`${user.name} (${user.role})`}>
                  <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials(user.name)}</span>
                  <span className="hidden text-sm leading-tight sm:block"><span className="block font-medium">{user.name}</span><span className="block capitalize text-muted">{user.role}</span></span>
                </span>
                <button
                  type="button"
                  aria-label="Log out"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-text"
                  onClick={() => { logout(); navigate('/login') }}
                >
                  <Icon name="logout" className="size-5" /><span className="hidden sm:inline">Log out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/register" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-background">Sign up</Link>
                <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Log in</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
