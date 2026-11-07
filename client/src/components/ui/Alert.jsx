const TONES = {
  danger: 'border-danger bg-danger-soft text-danger',
  success: 'border-success bg-success-soft text-success',
  warning: 'border-warning bg-warning-soft text-warning',
  info: 'border-primary bg-primary-soft text-primary',
}

export default function Alert({ tone = 'info', children, ...props }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`} {...props}>
      {children}
    </div>
  )
}
