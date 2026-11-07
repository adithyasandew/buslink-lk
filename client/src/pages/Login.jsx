import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homeFor(user)} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const u = await login(form)
      navigate(location.state?.from?.pathname ?? homeFor(u), { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const field = 'mt-1 block min-h-11 w-full rounded border border-border bg-surface px-3'

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className={field}
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className={field}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded bg-primary px-4 text-white hover:bg-primary-hover disabled:opacity-60">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </section>
  )
}
