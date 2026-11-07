import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
          <Link to="/" className="text-xl font-bold text-primary">BusLink LK</Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to={homeFor(user)} className="underline">Dashboard</Link>
                <span className="text-muted">{user.name} ({user.role})</span>
                <button
                  type="button"
                  className="min-h-11 rounded border border-border px-4"
                  onClick={() => { logout(); navigate('/login') }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="underline">Log in</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
