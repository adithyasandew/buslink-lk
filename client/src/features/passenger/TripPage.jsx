import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createBooking, getTrip } from '../../api/passenger'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { SelectField } from '../../components/ui/Field'
import { ErrorState, Loading } from '../../components/ui/States'
import { money, tripDate } from '../../lib/format'
import SeatMap from './SeatMap'

export default function TripPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: trip, loading, error, reload } = useResource(useCallback(() => getTrip(id), [id]))
  const [pickup, setPickup] = useState(params.get('pickup') ?? '')
  const [dropoff, setDropoff] = useState(params.get('dropoff') ?? '')
  const [seats, setSeats] = useState([])
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  if (loading && !trip) return <Loading />
  if (error && !trip) return <ErrorState error={error} onRetry={reload} />

  const stop = (sid) => trip.stops.find((s) => s.id === sid)
  const from = stop(pickup)
  const to = stop(dropoff)
  const validStops = from && to && from.order < to.order
  // Shown for guidance only; the server computes the real fare.
  const estimate = validStops ? (to.fareFromStart - from.fareFromStart) * seats.length : 0
  const toggle = (n) => setSeats(seats.includes(n) ? seats.filter((s) => s !== n) : [...seats, n].sort((a, b) => a - b))
  const open = trip.status === 'scheduled'

  const book = async () => {
    setBusy(true)
    setSubmitError(null)
    try {
      const booking = await createBooking({ tripId: id, pickupStopId: pickup, dropoffStopId: dropoff, seats })
      navigate(`/passenger/bookings/${booking._id}`)
    } catch (err) {
      setSubmitError(err.code === 'BOOKING_SEAT_TAKEN' ? 'Someone just booked one of those seats. The seat map has been refreshed — please choose again.' : err.message)
      if (err.code === 'BOOKING_SEAT_TAKEN') { setSeats([]); reload() }
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={() => navigate(-1)} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← Back to results</button>
        <h1>{trip.route.name}</h1>
        <p className="text-muted">{tripDate(trip.date)} · departs {trip.departureTime}</p>
      </div>
      {!open && <Alert tone="warning">This trip is {trip.status} and can no longer be booked.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card aria-label="Your journey">
            <h2 className="mb-3">Your journey</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Pickup stop" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                <option value="">Select…</option>
                {trip.stops.slice(0, -1).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
              <SelectField label="Drop-off stop" value={dropoff} onChange={(e) => setDropoff(e.target.value)}
                error={from && to && !validStops ? 'Drop-off must come after pickup' : undefined}>
                <option value="">Select…</option>
                {trip.stops.slice(1).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </div>
          </Card>
          <Card aria-label="Choose seats">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2>Choose seats</h2>
              <span className="text-sm text-muted">{trip.capacity - trip.takenSeats.length} of {trip.capacity} free</span>
            </div>
            <SeatMap capacity={trip.capacity} taken={trip.takenSeats} selected={seats} onToggle={toggle} />
            {seats.length >= 10 && <p className="mt-2 text-center text-sm text-muted">You can book up to 10 seats at once.</p>}
          </Card>
        </div>

        <Card as="aside" aria-label="Booking summary" className="h-fit space-y-3 lg:sticky lg:top-24">
          <h2>Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">From</dt><dd className="text-right font-medium">{from?.name ?? '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">To</dt><dd className="text-right font-medium">{to?.name ?? '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Seats</dt><dd className="text-right font-medium">{seats.length ? seats.join(', ') : '—'}</dd></div>
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base"><dt className="font-semibold">Estimated fare</dt><dd className="font-bold">{money(estimate)}</dd></div>
          </dl>
          <p className="text-xs text-muted">The final fare is confirmed by BusLink when you book.</p>
          {submitError && <Alert tone="danger">{submitError}</Alert>}
          <Button className="w-full" disabled={!open || !validStops || seats.length === 0 || busy} onClick={book}>
            {busy ? 'Booking…' : seats.length ? `Book ${seats.length} seat${seats.length > 1 ? 's' : ''}` : 'Select seats to book'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
