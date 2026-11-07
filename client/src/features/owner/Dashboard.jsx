import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { listBuses, listRoutes, listSchedules, listStaff } from '../../api/owner'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { ErrorState, Loading } from '../../components/ui/States'

const TILES = [
  { key: 'buses', label: 'Buses', to: '/owner/buses' },
  { key: 'staff', label: 'Staff', to: '/owner/staff' },
  { key: 'routes', label: 'Routes', to: '/owner/routes' },
  { key: 'schedules', label: 'Schedules', to: '/owner/schedules' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const load = useCallback(async () => {
    const [buses, staff, routes, schedules] = await Promise.all([listBuses(), listStaff(), listRoutes(), listSchedules()])
    return { buses, staff, routes, schedules }
  }, [])
  const { data, loading, error, reload } = useResource(load)

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.name ?? 'owner'}`} description="Manage your buses, staff, routes and schedules." />
      {user && !user.ownerVerified && (
        <div className="mb-4">
          <Alert tone="warning">Your owner account is awaiting verification by an administrator.</Alert>
        </div>
      )}
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(11rem, 100%), 1fr))' }}>
          {TILES.map((t) => (
            <li key={t.key}>
              <Link to={t.to} className="block min-h-11 rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary">
                <span className="block text-3xl font-bold">{data[t.key].length}</span>
                <span className="text-muted">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.buses.length === 0 && (
        <Card className="mt-6">
          <h2>Get started</h2>
          <p className="mt-1 text-muted">Register your first bus, then add a route and a schedule so passengers can book.</p>
          <Link to="/owner/buses" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline">Register a bus</Link>
        </Card>
      )}
    </div>
  )
}
