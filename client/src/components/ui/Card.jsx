export default function Card({ as: Tag = 'section', className = '', ...props }) {
  return <Tag className={`rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6 ${className}`} {...props} />
}
