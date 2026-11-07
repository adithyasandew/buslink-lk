import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth } from '../api/client'
import { useAuth } from '../app/AuthContext'
import { homeFor } from '../app/roles'
import Icon from '../components/ui/Icon'

const FEATURES = [
  { icon: 'route', title: 'Find your bus', text: 'Search routes and timings across Sri Lanka’s private bus services.' },
  { icon: 'calendar', title: 'Book a seat', text: 'Pick your seat and stops, and get a digital QR ticket.' },
  { icon: 'bus', title: 'Track it live', text: 'See where your bus is and get alerted when it is close.' },
]

export default function Home() {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    getHealth()
      .then((res) => setState({ ok: true, data: res.data }))
      .catch(() => setState({ ok: false }))
  }, [])

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-primary px-6 py-12 text-white shadow-card sm:px-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-soft">Private bus travel, simplified</p>
        <h1 className="mt-3 max-w-2xl text-[clamp(1.875rem,1.4rem+2.4vw,3rem)] leading-tight">Book, ride and track private buses in one place.</h1>
        <p className="mt-4 max-w-xl text-primary-soft">BusLink LK connects passengers, bus owners and crews so every trip is easier to plan and more predictable.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to={user ? homeFor(user) : '/login'} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 font-semibold text-primary hover:bg-primary-soft">
            {user ? 'Go to dashboard' : 'Log in'}
          </Link>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name={f.icon} /></span>
            <h2 className="mt-3">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </li>
        ))}
      </ul>

      <p role="status" className="text-center text-sm text-muted">
        {state.loading && 'Checking API…'}
        {state.ok && `API status: ${state.data.status} (database ${state.data.db})`}
        {state.ok === false && 'API is unreachable. Is the server running?'}
      </p>
    </div>
  )
}
