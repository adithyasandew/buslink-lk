import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { TextField } from '../components/ui/Field'
import Icon from '../components/ui/Icon'

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

  return (
    <section className="mx-auto max-w-md pt-4 sm:pt-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-white"><Icon name="bus" className="size-6" /></span>
        <h1 className="mt-4">Log in</h1>
        <p className="mt-1 text-muted">Welcome back to BusLink LK.</p>
      </div>
      <Card as="div">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        New to BusLink LK? <Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Create an account</Link>
      </p>
    </section>
  )
}
