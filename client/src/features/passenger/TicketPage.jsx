import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { getTicket, getTrip } from '../../api/passenger'
import useResource from '../../hooks/useResource'
import Badge from '../../components/ui/Badge'
import { ErrorState, Loading } from '../../components/ui/States'
import { money, STATUS_TONE, tripDate } from '../../lib/format'

export default function TicketPage() {
  const { id } = useParams()
  const load = useCallback(async () => {
    const ticket = await getTicket(id)
    return { ticket, trip: await getTrip(ticket.tripId) }
  }, [id])
  const { data, loading, error, reload } = useResource(load)
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!data) return
    // The QR only encodes the opaque verification token — never personal data.
    QRCode.toDataURL(data.ticket.qrToken, { width: 280, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(null))
  }, [data])

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const { ticket, trip } = data
  const usable = ticket.status === 'valid'

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link to="/passenger/bookings" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">← My trips</Link>
      <article aria-label={`Ticket ${ticket.ticketRef}`} className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <header className="bg-primary px-6 py-5 text-white">
          <p className="text-sm text-primary-soft">BusLink LK e-ticket</p>
          <h1 className="text-white">{trip.route.name}</h1>
          <p className="text-primary-soft">{tripDate(trip.date)} · {trip.departureTime}</p>
        </header>
        <div className="space-y-5 px-6 py-6">
          <div className="flex justify-center">
            {qr && usable
              ? <img src={qr} alt={`QR code for ticket ${ticket.ticketRef}`} className="size-60 rounded-xl border border-border p-2" />
              : <div className="grid size-60 place-items-center rounded-xl border border-dashed border-border-strong text-center text-sm text-muted">{usable ? 'Preparing QR…' : `This ticket is ${ticket.status}`}</div>}
          </div>
          <div className="text-center">
            <p className="text-sm text-muted">Ticket reference</p>
            <p className="font-mono text-2xl font-bold tracking-wider">{ticket.ticketRef}</p>
            <div className="mt-2"><Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge></div>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-dashed border-border-strong pt-4 text-sm">
            <div><dt className="text-muted">Seats</dt><dd className="font-semibold">{ticket.seats.join(', ')}</dd></div>
            <div><dt className="text-muted">Fare</dt><dd className="font-semibold">{money(ticket.fare)}</dd></div>
          </dl>
          {usable && <p className="text-center text-sm text-muted">Show this code to the conductor when you board. The reference above works if the code cannot be scanned.</p>}
        </div>
      </article>
    </div>
  )
}
