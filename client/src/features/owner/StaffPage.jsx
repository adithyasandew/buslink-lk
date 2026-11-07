import { useCallback, useState } from 'react'
import { assignStaff, createStaff, listBuses, listStaff, unassignStaff } from '../../api/owner'
import { fieldErrors } from '../../api/errors'
import { validateStaff } from './validators'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataList from '../../components/ui/DataList'
import { SelectField, TextField } from '../../components/ui/Field'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'

function StaffForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const found = validateStaff(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError(null)
    try {
      await createStaff({ name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || undefined })
      setForm({ name: '', email: '', phone: '', password: '' })
      onCreated()
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="form" onSubmit={submit} noValidate aria-label="Add staff" className="space-y-4">
      <h2>Add a driver or conductor</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="off" />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="off" />
        <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Temporary password" type="password" value={form.password} onChange={set('password')} error={errors.password} hint="They can use it to log in" autoComplete="new-password" />
      </div>
      {formError && !Object.keys(errors).length && <Alert tone="danger">{formError}</Alert>}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? 'Adding…' : 'Add staff'}</Button>
    </Card>
  )
}

function AssignPanel({ staff, buses }) {
  const [sel, setSel] = useState({ staffUserId: '', busId: '', staffType: 'driver' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setSel({ ...sel, [k]: e.target.value })
  const ready = sel.staffUserId && sel.busId

  const run = async (kind) => {
    setBusy(true)
    setMsg(null)
    try {
      if (kind === 'assign') await assignStaff(sel.busId, { staffUserId: sel.staffUserId, staffType: sel.staffType })
      else await unassignStaff(sel.busId, sel.staffUserId)
      setMsg({ tone: 'success', text: kind === 'assign' ? 'Staff assigned to bus' : 'Staff unassigned from bus' })
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card aria-label="Assign staff to a bus" className="space-y-4">
      <h2>Assign staff to a bus</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Staff member" value={sel.staffUserId} onChange={set('staffUserId')}>
          <option value="">Select…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <SelectField label="Bus" value={sel.busId} onChange={set('busId')}>
          <option value="">Select…</option>
          {buses.map((b) => <option key={b._id} value={b._id}>{b.registrationNumber}</option>)}
        </SelectField>
        <SelectField label="Role on the bus" value={sel.staffType} onChange={set('staffType')}>
          <option value="driver">Driver</option>
          <option value="conductor">Conductor</option>
        </SelectField>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={!ready || busy} onClick={() => run('assign')}>Assign</Button>
        <Button variant="secondary" disabled={!ready || busy} onClick={() => run('unassign')}>Unassign</Button>
      </div>
    </Card>
  )
}

export default function StaffPage() {
  const load = useCallback(async () => {
    const [staff, buses] = await Promise.all([listStaff(), listBuses()])
    return { staff, buses }
  }, [])
  const { data, loading, error, reload } = useResource(load)

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Drivers and conductors who run your buses." />
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <StaffForm onCreated={reload} />
          {data.staff.length === 0 ? (
            <EmptyState title="No staff yet">Add a driver or conductor above, then assign them to a bus.</EmptyState>
          ) : (
            <>
              <DataList
                items={data.staff}
                rowKey={(s) => s.id}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Phone', render: (s) => s.phone || '—' },
                ]}
              />
              {data.buses.length === 0
                ? <Alert tone="info">Register a bus first to assign staff.</Alert>
                : <AssignPanel staff={data.staff} buses={data.buses} />}
            </>
          )}
        </>
      )}
    </div>
  )
}
