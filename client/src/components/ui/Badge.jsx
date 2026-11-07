const TONES = {
  neutral: 'bg-background text-muted',
  info: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

/** Status is always conveyed by text, never by colour alone. */
export default function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TONES[tone]}`}>
      {children}
    </span>
  )
}
