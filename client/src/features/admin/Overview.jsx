import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getOverview, listRatings } from '../../api/admin'
import useResource from '../../hooks/useResource'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { ErrorState, Loading } from '../../components/ui/States'

export default function Overview() {
  const load = useCallback(async () => {
    const [overview, ratings] = await Promise.all([getOverview(), listRatings()])
    return { ...overview, ratings: ratings.meta }
  }, [])
  const { data, loading, error, reload } = useResource(load)

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const users = Object.values(data.usersByRole).reduce((a, b) => a + b, 0)
  const pending = data.busesByStatus.pending ?? 0
  const tiles = [
    { label: 'Buses awaiting verification', value: pending, to: '/admin/buses', icon: 'shield', attention: pending > 0 },
    { label: 'Open complaints', value: data.openComplaints, to: '/admin/complaints', icon: 'flag', attention: data.openComplaints > 0 },
    { label: 'Users', value: users, to: '/admin/users', icon: 'users' },
    { label: 'Bookings', value: data.bookings, icon: 'ticket' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Platform health, verification and passenger issues." />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <span className={`grid size-10 place-items-center rounded-xl ${t.attention ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'}`}><Icon name={t.icon} /></span>
              <span className="mt-3 block text-3xl font-bold tracking-tight">{t.value}</span>
              <span className="text-sm text-muted">{t.label}</span>
            </>
          )
          return (
            <li key={t.label}>
              {t.to
                ? <Link to={t.to} className="block min-h-11 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary">{body}</Link>
                : <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">{body}</div>}
            </li>
          )
        })}
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-label="Users by role">
          <h2 className="mb-3">Users by role</h2>
          <dl className="space-y-2">
            {[['passenger', 'Passengers'], ['owner', 'Owners'], ['staff', 'Staff'], ['admin', 'Admins']].map(([r, label]) => (
              <div key={r} className="flex justify-between"><dt className="text-muted">{label}</dt><dd className="font-semibold">{data.usersByRole[r] ?? 0}</dd></div>
            ))}
          </dl>
        </Card>
        <Card aria-label="Service rating">
          <h2 className="mb-3">Service rating</h2>
          {data.ratings.count === 0 ? <p className="text-muted">No ratings yet.</p> : (
            <p><span className="text-4xl font-bold">{data.ratings.average}</span><span className="text-muted"> / 5 from {data.ratings.count} rating{data.ratings.count === 1 ? '' : 's'}</span></p>
          )}
        </Card>
      </div>
    </div>
  )
}
