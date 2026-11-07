import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchTrips } from '../../api/passenger'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { TextField } from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { money, todayIso, tripDate } from '../../lib/format'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState({ from: params.get('from') ?? '', to: params.get('to') ?? '', date: params.get('date') ?? todayIso() })
  const [errors, setErrors] = useState({})
  const [state, setState] = useState({ status: 'idle' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const found = {}
    if (!form.from.trim()) found.from = 'Enter where you are starting from'
    if (!form.to.trim()) found.to = 'Enter where you are going'
    if (!form.date) found.date = 'Choose a travel date'
    setErrors(found)
    if (Object.keys(found).length) return
    const q = { from: form.from.trim(), to: form.to.trim(), date: form.date }
    setParams(q, { replace: true })
    setState({ status: 'loading' })
    try {
      setState({ status: 'done', trips: await searchTrips(q), q })
    } catch (error) {
      setState({ status: 'error', error })
    }
  }

  const swap = () => setForm({ ...form, from: form.to, to: form.from })

  return (
    <div>
      <PageHeader title="Find a bus" description="Search by the stop names on the route." />
      <Card as="form" onSubmit={submit} noValidate aria-label="Search trips" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr_12rem] sm:items-end">
          <TextField label="From" value={form.from} onChange={set('from')} error={errors.from} placeholder="e.g. Colombo Fort" />
          <Button variant="ghost" aria-label="Swap from and to" onClick={swap} className="justify-self-center">⇅</Button>
          <TextField label="To" value={form.to} onChange={set('to')} error={errors.to} placeholder="e.g. Kandy" />
          <TextField label="Date" type="date" min={todayIso()} value={form.date} onChange={set('date')} error={errors.date} />
        </div>
        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={state.status === 'loading'}>
          <Icon name="search" />{state.status === 'loading' ? 'Searching…' : 'Search buses'}
        </Button>
      </Card>

      {state.status === 'loading' && <Loading label="Searching…" />}
      {state.status === 'error' && <ErrorState error={state.error} />}
      {state.status === 'done' && state.trips.length === 0 && (
        <EmptyState title="No buses found">Check the stop names or try another date. Stop names must match the route, e.g. “Colombo Fort”.</EmptyState>
      )}
      {state.status === 'done' && state.trips.length > 0 && (
        <section aria-label="Search results">
          <h2 className="mb-3">{state.trips.length} bus{state.trips.length === 1 ? '' : 'es'} on {tripDate(state.q.date)}</h2>
          <ul className="space-y-3">
            {state.trips.map((t) => (
              <li key={t.tripId}>
                <Link
                  to={`/passenger/trips/${t.tripId}?pickup=${t.pickupStopId}&dropoff=${t.dropoffStopId}`}
                  className="flex min-h-11 flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-primary"
                  aria-label={`${t.departureTime} ${t.route}, ${money(t.fare)}, ${t.seatsAvailable} seats left`}
                >
                  <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name="clock" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-bold tracking-tight">{t.departureTime}</span>
                    <span className="block truncate text-sm text-muted">{t.route}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-semibold">{money(t.fare)}</span>
                    <span className={`block text-sm ${t.seatsAvailable > 0 ? 'text-muted' : 'text-danger'}`}>
                      {t.seatsAvailable > 0 ? `${t.seatsAvailable} seats left` : 'Full'}
                    </span>
                  </span>
                  <Icon name="chevron" className="size-5 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.status === 'idle' && (
        <EmptyState title="Where are you going?">Enter your pickup and drop-off stops to see buses, fares and free seats.</EmptyState>
      )}
    </div>
  )
}
