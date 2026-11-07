import { useState } from 'react'
import { createBus, deactivateBus, listBuses, updateBus } from '../../api/owner'
import { fieldErrors } from '../../api/errors'
import { validateBus } from './validators'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmAction from '../../components/ui/ConfirmAction'
import DataList from '../../components/ui/DataList'
import { TextField } from '../../components/ui/Field'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'

const STATUS_TONE = { pending: 'warning', verified: 'info', active: 'success', inactive: 'neutral' }

function BusForm({ bus, onDone, onCancel }) {
  const [form, setForm] = useState({
    registrationNumber: bus?.registrationNumber ?? '', model: bus?.model ?? '', capacity: bus?.capacity ?? '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const found = validateBus(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError(null)
    const body = { registrationNumber: form.registrationNumber.trim(), model: form.model.trim() || undefined, capacity: Number(form.capacity) }
    try {
      await (bus ? updateBus(bus._id, body) : createBus(body))
      onDone()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card as="form" onSubmit={submit} noValidate aria-label={bus ? 'Edit bus' : 'Register bus'} className="mb-6 space-y-4">
      <h2>{bus ? 'Edit bus' : 'Register a bus'}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Registration number" value={form.registrationNumber} onChange={set('registrationNumber')} error={errors.registrationNumber} autoCapitalize="characters" />
        <TextField label="Model (optional)" value={form.model} onChange={set('model')} error={errors.model} />
        <TextField label="Seats" type="number" inputMode="numeric" value={form.capacity} onChange={set('capacity')} error={errors.capacity} hint="Total passenger seats" />
      </div>
      {formError && !Object.keys(errors).length && <Alert tone="danger">{formError}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : bus ? 'Save changes' : 'Register bus'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}

export default function BusesPage() {
  const { data: buses, loading, error, reload } = useResource(listBuses)
  const [editing, setEditing] = useState(null) // null | 'new' | bus
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)

  const done = (msg) => () => { setEditing(null); setNotice(msg); reload() }
  const deactivate = async (bus) => {
    setActionError(null)
    try { await deactivateBus(bus._id); setNotice(`${bus.registrationNumber} deactivated`); reload() } catch (err) { setActionError(err.message) }
  }

  const columns = [
    { key: 'registrationNumber', label: 'Registration' },
    { key: 'model', label: 'Model', render: (b) => b.model || '—' },
    { key: 'capacity', label: 'Seats' },
    { key: 'status', label: 'Status', render: (b) => <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Buses" description="Register and manage your buses." action={!editing && <Button onClick={() => setEditing('new')}>Add bus</Button>} />
      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
      {actionError && <div className="mb-4"><Alert tone="danger">{actionError}</Alert></div>}
      {editing && <BusForm bus={editing === 'new' ? null : editing} onDone={done('Bus saved')} onCancel={() => setEditing(null)} />}
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {buses && buses.length === 0 && !editing && (
        <EmptyState title="No buses yet" action={<Button onClick={() => setEditing('new')}>Register your first bus</Button>}>
          Passengers can only book buses that are registered here and assigned to a route.
        </EmptyState>
      )}
      {buses && buses.length > 0 && (
        <DataList
          items={buses}
          columns={columns}
          actions={(b) => (
            <>
              <Button variant="secondary" onClick={() => setEditing(b)}>Edit</Button>
              {b.status !== 'inactive' && <ConfirmAction label="Deactivate" onConfirm={() => deactivate(b)} />}
            </>
          )}
        />
      )}
    </div>
  )
}
