import { listRatings } from '../../api/admin'
import useResource from '../../hooks/useResource'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { dateTime } from '../../lib/format'

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function RatingsPage() {
  const { data, loading, error, reload } = useResource(listRatings)

  return (
    <div>
      <PageHeader title="Ratings" description="What passengers say after completed trips." />
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <Card aria-label="Average rating" className="mb-4">
          {data.meta.count === 0 ? <p className="text-muted">No ratings yet.</p> : (
            <p><span className="text-4xl font-bold">{data.meta.average}</span><span className="text-muted"> / 5 average from {data.meta.count} rating{data.meta.count === 1 ? '' : 's'}</span></p>
          )}
        </Card>
      )}
      {data && data.items.length === 0 && <EmptyState title="No ratings yet">Passengers can rate a trip once it is completed.</EmptyState>}
      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r._id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg text-warning" aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</span>
                <span className="text-sm text-muted">{dateTime(r.createdAt)}</span>
              </div>
              {r.feedback && <p className="mt-2">{r.feedback}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
