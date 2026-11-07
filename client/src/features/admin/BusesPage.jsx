import { useCallback, useState } from 'react'
import { listAllBuses, verifyBus } from '../../api/admin'
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

const FILTERS = [
  { value: 'pending', label: 'Awaiting verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'active', label: 'Active' },
  { value: '', label: 'All' },
]

export default function BusesPage() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const load = useCallback(() => listAllBuses({ status: status || undefined, page }), [status, page])
  const { data, loading, error, reload } = useResource(load)
  const [msg, setMsg] = useState(null)

  const act = async (bus, verified) => {
    setMsg(null)
    try {
      await verifyBus(bus._id, verified)
      setMsg({ tone: 'success', text: `${bus.registrationNumber} ${verified ? 'verified — the owner can now activate it' : 'returned to pending'}.` })
      reload()
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message })
    }
  }

  return (
    <div>
      <PageHeader title="Bus verification" description="Check each bus and its owner before it can carry passengers." />
      <FilterTabs label="Bus status" options={FILTERS} value={status} onChange={(v) => { setStatus(v); setPage(1) }} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState title={status === 'pending' ? 'Nothing to verify' : 'No buses'}>{status === 'pending' ? 'New buses registered by owners will appear here.' : 'No buses match this filter.'}</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <DataList
            items={data.items}
            columns={[
              { key: 'registrationNumber', label: 'Registration' },
              { key: 'owner', label: 'Owner', render: (b) => <span>{b.owner?.name ?? '—'}{b.owner && !b.owner.verified && <span className="block text-xs text-warning">owner not verified</span>}</span> },
              { key: 'capacity', label: 'Seats' },
              { key: 'status', label: 'Status', render: (b) => <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge> },
            ]}
            actions={(b) => (b.status === 'pending'
              ? <Button onClick={() => act(b, true)} aria-label={`Verify ${b.registrationNumber}`}>Verify</Button>
              : b.status === 'verified' || b.status === 'active'
                ? <ConfirmAction label="Revoke" confirmLabel="Yes, revoke" onConfirm={() => act(b, false)} />
                : null)}
          />
          <Pager meta={data.meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
