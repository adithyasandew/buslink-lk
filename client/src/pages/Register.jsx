import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'
import { fieldErrors } from '../api/errors'
import { validateRegistration } from '../lib/authValidation'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { TextField } from '../components/ui/Field'
import Icon from '../components/ui/Icon'

const ACCOUNT_TYPES = [
  { value: 'passenger', title: 'Passenger', text: 'Find buses, book seats and track your trip.', icon: 'ticket' },
  { value: 'owner', title: 'Bus owner', text: 'Manage buses, crews, routes and schedules.', icon: 'bus' },
]

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ role: 'passenger', name: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (user) return <Navigate to={homeFor(user)} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    const found = validateRegistration(form)
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const u = await register({
        name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role,
        phone: form.phone.trim() || undefined,
      })
      navigate(homeFor(u), { replace: true })
    } catch (err) {
      const server = fieldErrors(err)
      if (err.code === 'EMAIL_IN_USE') server.email = 'An account with this email already exists. Log in instead?'
      setErrors(server)
      if (!Object.keys(server).length) setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-md pt-4 sm:pt-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-white"><Icon name="bus" className="size-6" /></span>
        <h1 className="mt-4">Create your account</h1>
        <p className="mt-1 text-muted">Join BusLink LK in under a minute.</p>
      </div>
      <Card as="div">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium">I am a</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ACCOUNT_TYPES.map((t) => (
                <label key={t.value} className={`relative flex min-h-11 cursor-pointer gap-3 rounded-xl border p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${form.role === t.value ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface'}`}>
                  <input type="radio" name="role" value={t.value} className="sr-only" checked={form.role === t.value} onChange={set('role')} />
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${form.role === t.value ? 'bg-primary text-white' : 'bg-background text-muted'}`}><Icon name={t.icon} /></span>
                  <span><span className="block font-semibold">{t.title}</span><span className="block text-xs text-muted">{t.text}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.role === 'owner' && <Alert tone="info">Owner accounts are reviewed by an administrator. You can set up buses right away; they go live once verified.</Alert>}
          <TextField label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <TextField label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="For trip updates from your bus" />
          <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters" />
          <TextField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating account…' : 'Create account'}</Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Log in</Link>
      </p>
    </section>
  )
}
