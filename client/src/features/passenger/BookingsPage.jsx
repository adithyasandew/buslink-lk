import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTrip, listBookings } from '../../api/passenger'
import useResource from '../../hooks/useResource'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { money, STATUS_TONE, tripDate } from '../../lib/format'

export default function BookingsPage() {
  const load = useCallback(async () => {
    const bookings = await listBookings()
    const ids = [...new Set(bookings.map((b) => b.tripId))]
    const trips = Object.fromEntries((await Promise.all(ids.map((id) => getTrip(id).catch(() => null)))).filter(Boolean).map((t) => [t.id, t]))
    return bookings.map((b) => ({ ...b, trip: trips[b.tripId] }))
  }, [])
  const { data, loading, error, reload } = useResource(load)

  return (
    <div>
      <PageHeader title="My trips" description="Your bookings, payments and tickets." action={<Link to="/passenger" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Book a trip</Link>} />
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="No trips yet" action={<Link to="/passenger"><Button>Search buses</Button></Link>}>Your bookings will appear here.</EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b._id}>
              <Link to={`/passenger/bookings/${b._id}`} className="flex min-h-11 flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-primary">
                <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name="ticket" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.trip?.route.name ?? 'Trip'}</span>
                  <span className="block text-sm text-muted">
                    {b.trip ? `${tripDate(b.trip.date)} · ${b.trip.departureTime}` : ''} · Seat{b.seats.length > 1 ? 's' : ''} {b.seats.join(', ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{money(b.fare)}</span>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
