import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { assignBusToRoute, deleteRoute, getRoute, listBuses, saveStops } from '../../api/owner'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmAction from '../../components/ui/ConfirmAction'
import { SelectField } from '../../components/ui/Field'
import { ErrorState, Loading } from '../../components/ui/States'
import StopsEditor from './StopsEditor'

export default function RouteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const load = useCallback(async () => {
    const [route, buses] = await Promise.all([getRoute(id), listBuses()])
    return { route, buses }
  }, [id])
  const { data, loading, error, reload } = useResource(load)
  const [busId, setBusId] = useState('')
  const [msg, setMsg] = useState(null)

  const assign = async () => {
    setMsg(null)
    try { await assignBusToRoute(id, busId); setBusId(''); setMsg({ tone: 'success', text: 'Bus assigned to route' }); reload() } catch (err) { setMsg({ tone: 'danger', text: err.message }) }
  }
  const remove = async () => {
    try { await deleteRoute(id); navigate('/owner/routes') } catch (err) { setMsg({ tone: 'danger', text: err.message }) }
  }

  // Only block the page on the first load; a refresh after saving must not unmount the editors.
  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const { route, buses } = data
  const assigned = buses.filter((b) => route.assignedBusIds.includes(b._id))
  const available = buses.filter((b) => !route.assignedBusIds.includes(b._id) && b.status !== 'inactive')

  return (
    <div className="space-y-6">
      <div>
        <Link to="/owner/routes" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← All routes</Link>
        <h1>{route.name}</h1>
        <p className="text-muted">{route.startPoint} → {route.destination}</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card aria-label="Stops">
        <h2 className="mb-3">Stops</h2>
        <StopsEditor initialStops={route.stops} onSave={async (stops) => { await saveStops(id, stops); reload() }} />
      </Card>

      <Card aria-label="Buses on this route" className="space-y-4">
        <h2>Buses on this route</h2>
        {assigned.length === 0 ? <p className="text-muted">No bus assigned yet.</p> : (
          <ul className="flex flex-wrap gap-2">{assigned.map((b) => <li key={b._id}><Badge tone="info">{b.registrationNumber}</Badge></li>)}</ul>
        )}
        {available.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <SelectField label="Assign a bus" value={busId} onChange={(e) => setBusId(e.target.value)}>
                <option value="">Select…</option>
                {available.map((b) => <option key={b._id} value={b._id}>{b.registrationNumber}</option>)}
              </SelectField>
            </div>
            <Button disabled={!busId} onClick={assign}>Assign bus</Button>
          </div>
        )}
      </Card>

      <Card aria-label="Danger zone">
        <h2 className="mb-2">Delete route</h2>
        <p className="mb-3 text-sm text-muted">Removes the route and its stops. This cannot be undone.</p>
        <ConfirmAction label="Delete route" confirmLabel="Yes, delete" onConfirm={remove} />
      </Card>
    </div>
  )
}
