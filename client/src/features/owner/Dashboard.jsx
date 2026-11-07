import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { listBuses, listRoutes, listSchedules, listStaff } from '../../api/owner'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { ErrorState, Loading } from '../../components/ui/States'

const TILES = [
  { key: 'buses', label: 'Buses', to: '/owner/buses', icon: 'bus' },
  { key: 'staff', label: 'Staff', to: '/owner/staff', icon: 'users' },
  { key: 'routes', label: 'Routes', to: '/owner/routes', icon: 'route' },
  { key: 'schedules', label: 'Schedules', to: '/owner/schedules', icon: 'calendar' },
]

function steps(d) {
  return [
    { label: 'Register a bus', done: d.buses.length > 0, to: '/owner/buses' },
    { label: 'Create a route and assign a bus to it', done: d.routes.some((r) => r.assignedBusIds.length > 0), to: '/owner/routes' },
    { label: 'Add a driver or conductor', done: d.staff.length > 0, to: '/owner/staff' },
    { label: 'Publish a schedule', done: d.schedules.length > 0, to: '/owner/schedules' },
  ]
}

function SetupChecklist({ data }) {
  const list = steps(data)
  const done = list.filter((s) => s.done).length
  if (done === list.length) return null
  return (
    <Card aria-label="Setup checklist" className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2>Finish setting up</h2>
        <span className="text-sm font-medium text-muted">{done} of {list.length} done</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={done} aria-label="Setup progress">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / list.length) * 100}%` }} />
      </div>
      <ul className="mt-4 divide-y divide-border">
        {list.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className="flex min-h-12 items-center gap-3 py-2">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${s.done ? 'bg-success text-white' : 'border-2 border-border-strong text-transparent'}`}>
                <Icon name="check" className="size-3.5" />
              </span>
              <span className={s.done ? 'text-muted line-through' : 'font-medium'}>{s.label}</span>
              <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
              {!s.done && <Icon name="chevron" className="ml-auto size-5 text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

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
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TILES.map((t) => (
              <li key={t.key}>
                <Link to={t.to} className="group block min-h-11 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name={t.icon} /></span>
                  <span className="mt-3 block text-3xl font-bold tracking-tight">{data[t.key].length}</span>
                  <span className="text-sm text-muted">{t.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <SetupChecklist data={data} />
        </>
      )}
    </div>
  )
}
