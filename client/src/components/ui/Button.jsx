const VARIANTS = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-hover',
  secondary: 'border border-border-strong bg-surface text-text hover:bg-background',
  danger: 'bg-danger text-white shadow-sm hover:opacity-90',
  ghost: 'text-muted hover:bg-background hover:text-text',
}

/** Touch-friendly button: at least 44px tall, clear disabled state. */
export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
