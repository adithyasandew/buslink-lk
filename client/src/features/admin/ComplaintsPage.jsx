import { useCallback, useState } from 'react'
import { listComplaints, updateComplaint } from '../../api/admin'
import useResource from '../../hooks/useResource'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmAction from '../../components/ui/ConfirmAction'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { dateTime, STATUS_TONE } from '../../lib/format'
import FilterTabs from './FilterTabs'

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]
const label = (s) => s.replace('_', ' ')

export default function ComplaintsPage() {
  const [status, setStatus] = useState('open')
  const load = useCallback(() => listComplaints({ status: status || undefined }), [status])
  const { data, loading, error, reload } = useResource(load)
  const [msg, setMsg] = useState(null)

  const move = async (c, next) => {
    setMsg(null)
    try { await updateComplaint(c._id, next); setMsg({ tone: 'success', text: `Complaint marked ${label(next)}. The passenger has been notified.` }); reload() } catch (err) { setMsg({ tone: 'danger', text: err.message }) }
  }

  return (
    <div>
      <PageHeader title="Complaints" description="Review passenger reports and keep them informed." />
      <FilterTabs label="Complaint status" options={FILTERS} value={status} onChange={setStatus} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No complaints here">{status === 'open' ? 'All caught up.' : 'Nothing matches this filter.'}</EmptyState>}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((c) => (
            <li key={c._id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={STATUS_TONE[c.status]}>{label(c.status)}</Badge>
                <span className="text-sm text-muted">{dateTime(c.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line">{c.details}</p>
              {(c.status === 'open' || c.status === 'in_review') && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status === 'open' && <Button onClick={() => move(c, 'in_review')}>Start review</Button>}
                  {c.status === 'in_review' && <Button onClick={() => move(c, 'resolved')}>Mark resolved</Button>}
                  <ConfirmAction label="Reject" confirmLabel="Yes, reject" onConfirm={() => move(c, 'rejected')} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
