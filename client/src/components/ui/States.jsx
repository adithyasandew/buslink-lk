import Alert from './Alert'
import Button from './Button'

/** Skeleton placeholders keep layout stable while data loads. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div role="status" className="space-y-3 py-2">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className="h-20 animate-pulse rounded-2xl bg-border/70" />
      ))}
    </div>
  )
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
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-4 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
