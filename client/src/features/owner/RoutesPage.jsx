import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createRoute, listRoutes } from '../../api/owner'
import { fieldErrors } from '../../api/errors'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { TextField } from '../../components/ui/Field'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { validateRoute } from './validators'

function RouteForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', startPoint: '', destination: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const found = validateRoute(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError(null)
    try {
      onCreated(await createRoute({ name: form.name.trim(), startPoint: form.startPoint.trim(), destination: form.destination.trim() }))
    } catch (err) {
      setErrors(fieldErrors(err))
      setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card as="form" onSubmit={submit} noValidate aria-label="Create route" className="mb-6 space-y-4">
      <h2>Create a route</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Route name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField label="Starting point" value={form.startPoint} onChange={set('startPoint')} error={errors.startPoint} />
        <TextField label="Destination" value={form.destination} onChange={set('destination')} error={errors.destination} />
      </div>
      {formError && !Object.keys(errors).length && <Alert tone="danger">{formError}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create route'}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}

export default function RoutesPage() {
  const { data: routes, loading, error, reload } = useResource(listRoutes)
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <PageHeader title="Routes" description="Define routes, then add their stops and buses." action={!adding && <Button onClick={() => setAdding(true)}>Add route</Button>} />
      {adding && <RouteForm onCancel={() => setAdding(false)} onCreated={() => { setAdding(false); reload() }} />}
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {routes && routes.length === 0 && !adding && (
        <EmptyState title="No routes yet" action={<Button onClick={() => setAdding(true)}>Create your first route</Button>}>
          A route needs at least two stops and an assigned bus before you can schedule it.
        </EmptyState>
      )}
      {routes && routes.length > 0 && (
        <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(18rem, 100%), 1fr))' }}>
          {routes.map((r) => (
            <li key={r._id}>
              <Link to={`/owner/routes/${r._id}`} className="block min-h-11 rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary">
                <span className="block font-semibold">{r.name}</span>
                <span className="mt-1 block text-sm text-muted">{r.startPoint} → {r.destination}</span>
                <span className="mt-3 block text-sm">{r.assignedBusIds.length} bus{r.assignedBusIds.length === 1 ? '' : 'es'} assigned</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
