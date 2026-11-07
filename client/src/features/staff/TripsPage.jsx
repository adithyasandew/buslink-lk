import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTrip } from '../../api/passenger'
import { listAssignedTrips } from '../../api/staff'
import useResource from '../../hooks/useResource'
import Badge from '../../components/ui/Badge'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { STATUS_TONE, todayIso, tripDate } from '../../lib/format'

function TripCard({ t }) {
  return (
    <Link to={`/staff/trips/${t.id}`} className="flex min-h-11 flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card hover:border-primary">
      <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name="bus" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold tracking-tight">{t.departureTime}</span>
        {/* Date on its own line so it is never truncated: upcoming trips on the same route differ only by date. */}
        <span className="block text-sm font-medium">{tripDate(t.date)}</span>
        <span className="block truncate text-sm text-muted">{t.route.name}</span>
      </span>
      <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
      <Icon name="chevron" className="size-5 text-muted" />
    </Link>
  )
}

export default function TripsPage() {
  const load = useCallback(async () => {
    const trips = await listAssignedTrips()
    return Promise.all(trips.map((t) => getTrip(t._id)))
  }, [])
  const { data, loading, error, reload } = useResource(load)

  const today = todayIso()
  const day = (t) => t.date.slice(0, 10)
  // Trips are stored per calendar date; compare with the local date so the grouping is right after midnight.
  const groups = data && [
    ['Today', data.filter((t) => day(t) === today)],
    ['Upcoming', data.filter((t) => day(t) > today)],
    ['Earlier', data.filter((t) => day(t) < today)],
  ]

  return (
    <div>
      <PageHeader title="Your trips" description="Start your trip and share the bus location with passengers." />
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No trips assigned">Ask the bus owner to assign you to a bus with a schedule.</EmptyState>}
      {groups && groups.map(([title, list]) => list.length > 0 && (
        <section key={title} aria-label={title} className="mb-6">
          <h2 className="mb-3">{title}</h2>
          <ul className="space-y-3">{list.map((t) => <li key={t.id}><TripCard t={t} /></li>)}</ul>
        </section>
      ))}
    </div>
  )
}
