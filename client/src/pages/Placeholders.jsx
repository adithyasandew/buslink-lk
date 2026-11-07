// Role dashboards are placeholders; module owners replace them with real screens.
function Placeholder({ title, module }) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{module} — coming soon.</p>
    </section>
  )
}

export const AdminDashboard = () => <Placeholder title="Administrator dashboard" module="Module 5" />

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
