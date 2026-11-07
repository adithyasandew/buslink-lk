export function Forbidden() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="mt-2 text-muted">Your account does not have permission to view this page.</p>
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
    </section>
  )
}
