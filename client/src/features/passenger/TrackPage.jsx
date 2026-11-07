import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBooking, getTrip, getTripLocation, setPickupPoint } from '../../api/passenger'
import { connectSocket } from '../../api/socket'
import useResource from '../../hooks/useResource'
import MapView from '../../components/MapView'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { SelectField } from '../../components/ui/Field'
import { ErrorState, Loading } from '../../components/ui/States'
import { formatDistance, distanceMeters, nearestStop } from '../../lib/geo'
import { STATUS_TONE, tripDate } from '../../lib/format'

const STALE_MS = 2 * 60 * 1000
const DISTANCES = [250, 500, 1000, 2000]

function ago(ms) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

function AlertSettings({ booking, pickupStop, onSaved }) {
  const [distance, setDistance] = useState(String(booking.approachDistanceMeters ?? 500))
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (point) => {
    setBusy(true)
    setMsg(null)
    try {
      await setPickupPoint(booking._id, { ...point, approachDistanceMeters: Number(distance) })
      setMsg({ tone: 'success', text: `We will alert you when the bus is within ${formatDistance(Number(distance))}.` })
      onSaved()
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }
  // Location permission is only requested when the passenger chooses this option.
  const useMyLocation = () => {
    if (!navigator.geolocation) return setMsg({ tone: 'danger', text: 'Your browser cannot share its location.' })
    navigator.geolocation.getCurrentPosition(
      (p) => save({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setMsg({ tone: 'danger', text: 'Location permission was not given. Your pickup stop is used instead.' }),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <Card aria-label="Approach alert" className="space-y-4">
      <h2>Approach alert</h2>
      <SelectField label="Alert me when the bus is within" value={distance} onChange={(e) => setDistance(e.target.value)}>
        {DISTANCES.map((d) => <option key={d} value={d}>{formatDistance(d)}</option>)}
      </SelectField>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={busy} onClick={() => save({ lat: pickupStop.location.lat, lng: pickupStop.location.lng })}>Use my pickup stop</Button>
        <Button variant="secondary" disabled={busy} onClick={useMyLocation}>Use where I am now</Button>
      </div>
      <p className="text-xs text-muted">“Use where I am now” asks your browser for your location once. It is only used for this alert.</p>
    </Card>
  )
}

export default function TrackPage() {
  const { id } = useParams()
  const load = useCallback(async () => {
    const booking = await getBooking(id)
    const [trip, live] = await Promise.all([getTrip(booking.tripId), getTripLocation(booking.tripId).catch(() => null)])
    return { booking, trip, live }
  }, [id])
  const { data, loading, error, reload } = useResource(load)
  const [bus, setBus] = useState(null)
  const [tripStatus, setTripStatus] = useState(null)
  const [approach, setApproach] = useState(null)
  const [connected, setConnected] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const tripId = data?.trip.id
  const initialBus = data?.live?.location
  const shownBus = bus ?? initialBus ?? null
  const status = tripStatus ?? data?.live?.tripStatus ?? data?.trip.status

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!tripId || data.booking.status !== 'confirmed') return undefined
    const socket = connectSocket()
    socket.on('connect', () => { setConnected(true); socket.emit('trip:join', { tripId }) })
    socket.on('disconnect', () => setConnected(false))
    socket.on('location:updated', (l) => l.tripId === tripId && setBus(l))
    socket.on('trip:status', (s) => s.tripId === tripId && setTripStatus(s.status))
    socket.on('bus:approaching', (a) => a.tripId === tripId && setApproach(a))
    return () => socket.close()
  }, [tripId, data?.booking.status])

  const pickupStop = useMemo(() => data?.trip.stops.find((s) => s.id === data.booking.pickupStopId), [data])
  const pickupPoint = data?.booking.pickupPoint?.lat != null ? data.booking.pickupPoint : pickupStop?.location

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const { booking, trip } = data
  if (booking.status !== 'confirmed') {
    return <Alert tone="warning">Live tracking is available once your booking is confirmed.</Alert>
  }

  const age = shownBus ? now - new Date(shownBus.recordedAt).getTime() : null
  const stale = age != null && age > STALE_MS
  const near = shownBus && nearestStop(trip.stops, shownBus)
  const toPickup = shownBus && pickupPoint && distanceMeters(shownBus, pickupPoint)

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/passenger/bookings/${booking._id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← Booking</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1>Track your bus</h1>
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
        </div>
        <p className="text-muted">{trip.route.name} · {tripDate(trip.date)} · {trip.departureTime}</p>
      </div>

      {approach && <Alert tone="success">Your bus is about {formatDistance(approach.distanceMeters)} away. Please be ready at your pickup point.</Alert>}

      <MapView stops={trip.stops} bus={shownBus} pickup={pickupPoint} />

      <Card aria-label="Live status" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2>Live status</h2>
          <span className="text-sm text-muted">{connected ? 'Live updates on' : 'Connecting…'}</span>
        </div>
        {!shownBus && <p className="text-muted">{status === 'scheduled' ? 'The trip has not started yet. The bus location appears here once the crew starts the trip.' : 'No location has been shared yet.'}</p>}
        {shownBus && (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Nearest stop</dt><dd className="font-semibold">{near.stop.name} ({formatDistance(near.distance)})</dd></div>
            <div><dt className="text-sm text-muted">Distance to your pickup</dt><dd className="font-semibold">{toPickup != null ? formatDistance(toPickup) : '—'}</dd></div>
            <div><dt className="text-sm text-muted">Last updated</dt><dd className="font-semibold">{ago(age)}</dd></div>
          </dl>
        )}
        {stale && <div className="mt-3"><Alert tone="warning">This location may be out of date — the bus has not reported for a while.</Alert></div>}
      </Card>

      {status === 'scheduled' || status === 'active' ? <AlertSettings booking={booking} pickupStop={pickupStop} onSaved={reload} /> : null}
    </div>
  )
}
