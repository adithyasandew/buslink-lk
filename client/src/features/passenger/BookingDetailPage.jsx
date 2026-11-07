import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cancelBooking, getBooking, getTrip, payBooking } from '../../api/passenger'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmAction from '../../components/ui/ConfirmAction'
import { SelectField } from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import { ErrorState, Loading } from '../../components/ui/States'
import { money, STATUS_TONE, tripDate } from '../../lib/format'

const linkButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold'

function PaymentCard({ booking, onPaid }) {
  const [method, setMethod] = useState('mock_card')
  const [outcome, setOutcome] = useState('success')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const pay = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { payment } = await payBooking({ bookingId: booking._id, method, simulate: outcome })
      if (payment.status === 'success') onPaid('Payment received — your ticket is ready.')
      else if (payment.status === 'failed') setMsg({ tone: 'danger', text: 'The payment failed. You have not been charged; please try again.' })
      else onPaid('Payment is being processed. We will notify you when it completes.')
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card aria-label="Payment" className="space-y-4">
      <div className="flex items-center gap-2"><Icon name="card" className="size-5 text-primary" /><h2>Pay to confirm</h2></div>
      <Alert tone="info">Sandbox payment — no real money is taken.</Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="mock_card">Card (test)</option>
          <option value="mock_wallet">Mobile wallet (test)</option>
        </SelectField>
        <SelectField label="Sandbox outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} hint="For demonstrations only">
          <option value="success">Approve</option>
          <option value="fail">Decline</option>
          <option value="pending">Leave pending</option>
        </SelectField>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button className="w-full sm:w-auto" disabled={busy} onClick={pay}>{busy ? 'Processing…' : `Pay ${money(booking.fare)}`}</Button>
    </Card>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const load = useCallback(async () => {
    const booking = await getBooking(id)
    const trip = await getTrip(booking.tripId)
    return { booking, trip }
  }, [id])
  const { data, loading, error, reload } = useResource(load)
  const [notice, setNotice] = useState(null)

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const { booking, trip } = data
  const stopName = (sid) => trip.stops.find((s) => s.id === sid)?.name ?? '—'
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && trip.status === 'scheduled'

  const cancel = async () => {
    try {
      const res = await cancelBooking(booking._id)
      setNotice({ tone: 'success', text: res.refund ? `Booking cancelled. ${money(res.refund.amount)} has been refunded.` : 'Booking cancelled.' })
      reload()
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/passenger/bookings" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← My trips</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1>{trip.route.name}</h1>
          <Badge tone={STATUS_TONE[booking.status]}>{booking.status}</Badge>
        </div>
        <p className="text-muted">{tripDate(trip.date)} · departs {trip.departureTime}</p>
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card aria-label="Booking details">
        <dl className="grid gap-4 sm:grid-cols-4">
          <div><dt className="text-sm text-muted">Pickup</dt><dd className="font-semibold">{stopName(booking.pickupStopId)}</dd></div>
          <div><dt className="text-sm text-muted">Drop-off</dt><dd className="font-semibold">{stopName(booking.dropoffStopId)}</dd></div>
          <div><dt className="text-sm text-muted">Seats</dt><dd className="font-semibold">{booking.seats.join(', ')}</dd></div>
          <div><dt className="text-sm text-muted">Fare</dt><dd className="font-semibold">{money(booking.fare)}</dd></div>
        </dl>
      </Card>

      {booking.status === 'pending' && trip.status === 'scheduled' && (
        <PaymentCard booking={booking} onPaid={(text) => { setNotice({ tone: 'success', text }); reload() }} />
      )}

      {booking.status === 'confirmed' && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {booking.ticketId && <Link to={`/passenger/tickets/${booking.ticketId}`} className={`${linkButton} bg-primary text-white shadow-sm hover:bg-primary-hover`}><Icon name="ticket" />View ticket</Link>}
          <Link to={`/passenger/bookings/${booking._id}/track`} className={`${linkButton} border border-border-strong bg-surface hover:bg-background`}><Icon name="map" />Track bus</Link>
        </div>
      )}

      {canCancel && (
        <Card aria-label="Cancel booking">
          <h2 className="mb-1">Cancel booking</h2>
          <p className="mb-3 text-sm text-muted">{booking.status === 'confirmed' ? 'You will be refunded in full and your seats released.' : 'Your seats will be released.'}</p>
          <ConfirmAction label="Cancel booking" confirmLabel="Yes, cancel" onConfirm={cancel} />
        </Card>
      )}
    </div>
  )
}
