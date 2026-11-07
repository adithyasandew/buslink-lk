import { useState } from 'react'
import Button from './Button'

/** Two-step control for destructive actions (no accidental one-tap deletes on touch screens). */
export default function ConfirmAction({ label, confirmLabel = 'Confirm', onConfirm, disabled }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return <Button variant="secondary" disabled={disabled} onClick={() => setAsking(true)}>{label}</Button>
  }
  return (
    <span className="flex gap-2" role="group" aria-label={`Confirm ${label}`}>
      <Button variant="danger" onClick={() => { setAsking(false); onConfirm() }}>{confirmLabel}</Button>
      <Button variant="secondary" onClick={() => setAsking(false)}>Cancel</Button>
    </span>
  )
}
