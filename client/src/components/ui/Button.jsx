const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-text hover:bg-background',
  danger: 'bg-danger text-white hover:opacity-90',
}

/** Touch-friendly button: at least 44px tall, clear disabled state. */
export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
