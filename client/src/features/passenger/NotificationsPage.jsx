import { useState } from 'react'
import { listNotifications, markNotificationRead } from '../../api/passenger'
import useResource from '../../hooks/useResource'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'
import { EmptyState, ErrorState, Loading } from '../../components/ui/States'
import { dateTime } from '../../lib/format'

const ICON = { bus_approaching: 'pin', trip_status: 'bus', payment_success: 'card', payment_failed: 'card', payment_refunded: 'card' }

export default function NotificationsPage() {
  const { data, loading, error, reload } = useResource(listNotifications)
  const [read, setRead] = useState({})

  const mark = async (n) => {
    setRead((r) => ({ ...r, [n._id]: true }))
    try { await markNotificationRead(n._id) } catch { setRead((r) => ({ ...r, [n._id]: false })) }
  }
  const isUnread = (n) => n.status === 'unread' && !read[n._id]

  return (
    <div>
      <PageHeader title="Alerts" description="Booking, payment and trip updates." />
      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No alerts yet">You will see booking, payment and bus updates here.</EmptyState>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {data.map((n) => (
            <li key={n._id} className={`flex items-start gap-3 p-4 ${isUnread(n) ? 'bg-primary-soft/40' : ''}`}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name={ICON[n.type] ?? 'ticket'} /></span>
              <div className="min-w-0 flex-1">
                <p className={isUnread(n) ? 'font-semibold' : ''}>{n.message}</p>
                <p className="text-sm text-muted">{dateTime(n.createdAt)}{isUnread(n) && <span className="sr-only"> (unread)</span>}</p>
              </div>
              {isUnread(n) && <Button variant="ghost" onClick={() => mark(n)} aria-label={`Mark as read: ${n.message}`}>Mark read</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
