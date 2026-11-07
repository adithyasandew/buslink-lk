import Button from '../../components/ui/Button'

export default function Pager({ meta, onPage }) {
  if (!meta || meta.total <= meta.limit) return null
  const pages = Math.ceil(meta.total / meta.limit)
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
      <span className="text-sm text-muted">Page {meta.page} of {pages}</span>
      <Button variant="secondary" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
    </nav>
  )
}
