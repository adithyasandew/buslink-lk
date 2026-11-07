import { useCallback, useState } from 'react'
import { useAuth } from '../../app/AuthContext'
import { listUsers, updateUser, verifyOwner } from '../../api/admin'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmAction from '../../components/ui/ConfirmAction'
import DataList from '../../components/ui/DataList'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { STATUS_TONE } from '../../lib/format'
import FilterTabs from './FilterTabs'
import Pager from './Pager'

const ROLES = [
  { value: '', label: 'All' },
  { value: 'passenger', label: 'Passengers' },
  { value: 'owner', label: 'Owners' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admins' },
]

export default function UsersPage() {
  const { user: me } = useAuth()
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const load = useCallback(() => listUsers({ role: role || undefined, page }), [role, page])
  const { data, loading, error, reload } = useResource(load)
  const [msg, setMsg] = useState(null)

  const run = async (fn, text) => {
    setMsg(null)
    try { await fn(); setMsg({ tone: 'success', text }); reload() } catch (err) { setMsg({ tone: 'danger', text: err.message }) }
  }

  return (
    <div>
      <PageHeader title="Users" description="Suspend accounts and verify bus owners." />
      <FilterTabs label="Role" options={ROLES} value={role} onChange={(v) => { setRole(v); setPage(1) }} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState title="No users">No users match this filter.</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <DataList
            items={data.items}
            rowKey={(u) => u.id}
            columns={[
              { key: 'name', label: 'Name', render: (u) => <span>{u.name}<span className="block text-xs text-muted">{u.email}</span></span> },
              { key: 'role', label: 'Role', render: (u) => <span className="capitalize">{u.role}{u.role === 'owner' && <span className={`block text-xs ${u.ownerVerified ? 'text-success' : 'text-warning'}`}>{u.ownerVerified ? 'verified owner' : 'not verified'}</span>}</span> },
              { key: 'status', label: 'Status', render: (u) => <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge> },
            ]}
            actions={(u) => (u.id === me?.id ? <span className="text-sm text-muted">This is you</span> : (
              <>
                {u.role === 'owner' && (u.ownerVerified
                  ? <ConfirmAction label="Unverify owner" confirmLabel="Yes, unverify" onConfirm={() => run(() => verifyOwner(u.id, false), `${u.name} is no longer verified.`)} />
                  : <Button onClick={() => run(() => verifyOwner(u.id, true), `${u.name} is now a verified owner.`)} aria-label={`Verify owner ${u.name}`}>Verify owner</Button>)}
                {u.status === 'suspended'
                  ? <Button variant="secondary" onClick={() => run(() => updateUser(u.id, { status: 'active' }), `${u.name} can sign in again.`)} aria-label={`Reactivate ${u.name}`}>Reactivate</Button>
                  : <ConfirmAction label="Suspend" confirmLabel="Yes, suspend" onConfirm={() => run(() => updateUser(u.id, { status: 'suspended' }), `${u.name} has been suspended and signed out.`)} />}
              </>
            ))}
          />
          <Pager meta={data.meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
