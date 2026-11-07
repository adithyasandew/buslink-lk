import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTrip } from '../../api/passenger'
import { endTrip, startTrip } from '../../api/staff'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmAction from '../../components/ui/ConfirmAction'
import Icon from '../../components/ui/Icon'
import { ErrorState, Loading } from '../../components/ui/States'
import { formatDistance, nearestStop } from '../../lib/geo'
import { STATUS_TONE, tripDate } from '../../lib/format'
import useLocationSharing from './useLocationSharing'

function SharingCard({ trip }) {
  const { mode, setMode, last, error } = useLocationSharing(trip.id, trip.stops)
  const near = last && nearestStop(trip.stops, last)
  return (
    <Card aria-label="Location sharing" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2>Location sharing</h2>
        <Badge tone={mode === 'off' ? 'neutral' : 'success'}>{mode === 'off' ? 'off' : mode === 'gps' ? 'sharing' : 'demo'}</Badge>
      </div>
      {mode === 'off' && <p className="text-sm text-muted">Passengers on this trip see the bus on their map and get an alert when it is close. Your location is only shared while this trip is active and sharing is on.</p>}
      {error && <Alert tone="danger">{error}</Alert>}
      {last && (
        <dl className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <div><dt className="text-sm text-muted">Last sent</dt><dd className="font-semibold">{last.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</dd></div>
          <div><dt className="text-sm text-muted">Nearest stop</dt><dd className="font-semibold">{near.stop.name} ({formatDistance(near.distance)})</dd></div>
          <div><dt className="text-sm text-muted">Accuracy</dt><dd className="font-semibold">{last.accuracy != null ? `± ${last.accuracy} m` : '—'}</dd></div>
        </dl>
      )}
      {mode === 'off' ? (
        <Button className="w-full sm:w-auto" onClick={() => setMode('gps')}><Icon name="pin" />Share my location</Button>
      ) : (
        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setMode('off')}>Stop sharing</Button>
      )}
      {mode === 'off' && (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Demo mode (no GPS)</summary>
          <p className="mt-2 text-sm text-muted">Simulates the bus driving along the route stops, sending a position every 3 seconds. For demonstrations only.</p>
          <Button variant="secondary" className="mt-3" onClick={() => setMode('demo')}>Simulate the drive</Button>
        </details>
      )}
    </Card>
  )
}

export default function TripDetailPage() {
  const { id } = useParams()
  const { data: trip, loading, error, reload } = useResource(useCallback(() => getTrip(id), [id]))
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const change = async (fn, text) => {
    setBusy(true)
    setMsg(null)
    try { await fn(id); setMsg({ tone: 'success', text }); reload() } catch (err) { setMsg({ tone: 'danger', text: err.message }) } finally { setBusy(false) }
  }

  if (loading && !trip) return <Loading />
  if (error && !trip) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <div>
        <Link to="/staff" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← Your trips</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1>{trip.route.name}</h1>
          <Badge tone={STATUS_TONE[trip.status]}>{trip.status}</Badge>
        </div>
        <p className="text-muted">{tripDate(trip.date)} · departs {trip.departureTime} · {trip.takenSeats.length} of {trip.capacity} seats booked</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {trip.status === 'scheduled' && (
        <Card aria-label="Start trip">
          <h2 className="mb-1">Ready to go?</h2>
          <p className="mb-3 text-sm text-muted">Starting the trip notifies booked passengers and lets you share the bus location.</p>
          <ConfirmAction label="Start trip" confirmLabel="Yes, start now" disabled={busy} onConfirm={() => change(startTrip, 'Trip started. Passengers have been notified.')} />
        </Card>
      )}

      {trip.status === 'active' && <SharingCard trip={trip} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/staff/verify" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-background"><Icon name="scan" />Verify a ticket</Link>
        {trip.status === 'active' && <ConfirmAction label="End trip" confirmLabel="Yes, end trip" disabled={busy} onConfirm={() => change(endTrip, 'Trip completed. Location sharing has stopped.')} />}
      </div>

      <Card aria-label="Stops">
        <h2 className="mb-3">Stops</h2>
        <ol className="space-y-2">
          {trip.stops.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
              <span>{s.name}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
