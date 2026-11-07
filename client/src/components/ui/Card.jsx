export default function Card({ as: Tag = 'section', className = '', ...props }) {
  return <Tag className={`rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6 ${className}`} {...props} />
}
