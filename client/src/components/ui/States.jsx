import Alert from './Alert'
import Button from './Button'

export function Loading({ label = 'Loading…' }) {
  return <p role="status" className="py-8 text-center text-muted">{label}</p>
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="space-y-3 py-4">
      <Alert tone="danger">{error?.message ?? 'Something went wrong.'}</Alert>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
