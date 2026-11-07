import { useCallback, useState } from 'react'
import { createSchedule, deactivateSchedule, generateTrips, listBuses, listRoutes, listSchedules } from '../../api/owner'
import { fieldErrors } from '../../api/errors'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmAction from '../../components/ui/ConfirmAction'
import DataList from '../../components/ui/DataList'
import { SelectField, TextField } from '../../components/ui/Field'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { validateSchedule } from './validators'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = () => new Date().toISOString().slice(0, 10)

function ScheduleForm({ buses, routes, onCreated, onCancel }) {
  const [form, setForm] = useState({ busId: '', routeId: '', departureTime: '', arrivalTime: '', operatingDays: [] })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const toggle = (d) => setForm({ ...form, operatingDays: form.operatingDays.includes(d) ? form.operatingDays.filter((x) => x !== d) : [...form.operatingDays, d].sort() })

  const submit = async (e) => {
    e.preventDefault()
    const found = validateSchedule(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError(null)
    try {
      await createSchedule(form)
      onCreated()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card as="form" onSubmit={submit} noValidate aria-label="Create schedule" className="mb-6 space-y-4">
      <h2>Create a schedule</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Bus" value={form.busId} onChange={set('busId')} error={errors.busId}>
          <option value="">Select…</option>
          {buses.filter((b) => b.status !== 'inactive').map((b) => <option key={b._id} value={b._id}>{b.registrationNumber}</option>)}
        </SelectField>
        <SelectField label="Route" value={form.routeId} onChange={set('routeId')} error={errors.routeId} hint="The bus must already be assigned to this route">
          <option value="">Select…</option>
          {routes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
        </SelectField>
        <TextField label="Departure time" type="time" value={form.departureTime} onChange={set('departureTime')} error={errors.departureTime} />
        <TextField label="Arrival time" type="time" value={form.arrivalTime} onChange={set('arrivalTime')} error={errors.arrivalTime} />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Operating days</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((label, d) => (
            <label key={label} className={`inline-flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${form.operatingDays.includes(d) ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}>
              <input type="checkbox" className="sr-only" checked={form.operatingDays.includes(d)} onChange={() => toggle(d)} />
              {label}
            </label>
          ))}
        </div>
        {errors.operatingDays && <p role="alert" className="mt-1 text-sm text-danger">{errors.operatingDays}</p>}
      </fieldset>
      {formError && !Object.keys(errors).length && <Alert tone="danger">{formError}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create schedule'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}

function GenerateTrips({ schedule, onDone }) {
  const [range, setRange] = useState({ from: today(), to: today() })
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const { created } = await generateTrips(schedule._id, range)
      onDone({ tone: 'success', text: created.length ? `Created ${created.length} trip(s): ${created.join(', ')}` : 'No new trips — they already exist or no operating days fall in this range' })
    } catch (err) {
      onDone({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <TextField label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
      <TextField label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      <Button variant="secondary" disabled={busy || !range.from || !range.to} onClick={run}>{busy ? 'Generating…' : 'Generate trips'}</Button>
    </div>
  )
}

export default function SchedulesPage() {
  const load = useCallback(async () => {
    const [schedules, buses, routes] = await Promise.all([listSchedules(), listBuses(), listRoutes()])
    return { schedules, buses, routes }
  }, [])
  const { data, loading, error, reload } = useResource(load)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)
  const [generating, setGenerating] = useState(null)

  const name = (list, id, key) => list.find((x) => x._id === id)?.[key] ?? '—'
  const deactivate = async (s) => {
    try { await deactivateSchedule(s._id); setMsg({ tone: 'success', text: 'Schedule deactivated' }); reload() } catch (err) { setMsg({ tone: 'danger', text: err.message }) }
  }

  return (
    <div>
      <PageHeader title="Schedules" description="Set departure times and operating days, then generate dated trips." action={!adding && data && <Button onClick={() => setAdding(true)}>Add schedule</Button>} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && adding && <ScheduleForm buses={data.buses} routes={data.routes} onCancel={() => setAdding(false)} onCreated={() => { setAdding(false); setMsg({ tone: 'success', text: 'Schedule created' }); reload() }} />}
      {data && data.schedules.length === 0 && !adding && (
        <EmptyState title="No schedules yet" action={<Button onClick={() => setAdding(true)}>Create a schedule</Button>}>
          You need a bus assigned to a route first.
        </EmptyState>
      )}
      {data && data.schedules.length > 0 && (
        <DataList
          items={data.schedules}
          columns={[
            { key: 'route', label: 'Route', render: (s) => name(data.routes, s.routeId, 'name') },
            { key: 'bus', label: 'Bus', render: (s) => name(data.buses, s.busId, 'registrationNumber') },
            { key: 'time', label: 'Time', render: (s) => `${s.departureTime} → ${s.arrivalTime}` },
            { key: 'days', label: 'Days', render: (s) => s.operatingDays.map((d) => DAYS[d]).join(', ') },
            { key: 'active', label: 'Status', render: (s) => <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'active' : 'inactive'}</Badge> },
          ]}
          actions={(s) => s.active && (
            generating === s._id
              ? <GenerateTrips schedule={s} onDone={(m) => { setMsg(m); setGenerating(null) }} />
              : (<>
                  <Button variant="secondary" onClick={() => setGenerating(s._id)}>Generate trips</Button>
                  <ConfirmAction label="Deactivate" onConfirm={() => deactivate(s)} />
                </>)
          )}
        />
      )}
    </div>
  )
}
