import { useId } from 'react'

const control =
  'block min-h-11 w-full rounded-xl border bg-surface px-3 text-base text-text shadow-sm placeholder:text-muted focus:border-primary'

function Wrapper({ label, error, hint, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}

const describe = (id, error, hint) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined)

export function TextField({ label, error, hint, ...props }) {
  const id = useId()
  return (
    <Wrapper label={label} error={error} hint={hint} id={id}>
      <input
        id={id}
        className={`${control} ${error ? 'border-danger' : 'border-border-strong'}`}
        aria-invalid={Boolean(error)}
        aria-describedby={describe(id, error, hint)}
        {...props}
      />
    </Wrapper>
  )
}

export function SelectField({ label, error, hint, children, ...props }) {
  const id = useId()
  return (
    <Wrapper label={label} error={error} hint={hint} id={id}>
      <select
        id={id}
        className={`${control} ${error ? 'border-danger' : 'border-border-strong'}`}
        aria-invalid={Boolean(error)}
        aria-describedby={describe(id, error, hint)}
        {...props}
      >
        {children}
      </select>
    </Wrapper>
  )
}
