import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { validateStops } from './validators'

const blank = () => ({ name: '', lat: '', lng: '', fareFromStart: '' })
const toForm = (stops) => (stops.length ? stops.map((s) => ({ name: s.name, lat: String(s.location.lat), lng: String(s.location.lng), fareFromStart: String(s.fareFromStart) })) : [blank(), blank()])

/** Ordered stop list. Each stop is a stacked card on mobile and a 4-column row from sm up. */
export default function StopsEditor({ initialStops, onSave }) {
  const [rows, setRows] = useState(() => toForm(initialStops))
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const edit = (i, k, v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }

  const save = async () => {
    const found = validateStops(rows)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setMsg(null)
    try {
      await onSave(rows.map((r) => ({ name: r.name.trim(), lat: Number(r.lat), lng: Number(r.lng), fareFromStart: Number(r.fareFromStart) })))
      setMsg({ tone: 'success', text: 'Stops saved' })
    } catch (err) {
      setMsg({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">List stops in travel order. Fare is the amount from the first stop, so it can only stay the same or increase.</p>
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-border bg-background p-3" aria-label={`Stop ${i + 1}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Stop {i + 1}</span>
              <div className="flex gap-1">
                <Button variant="secondary" className="px-3" aria-label={`Move stop ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button variant="secondary" className="px-3" aria-label={`Move stop ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button variant="secondary" aria-label={`Remove stop ${i + 1}`} disabled={rows.length <= 2} onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>Remove</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField label="Name" value={r.name} onChange={(e) => edit(i, 'name', e.target.value)} error={errors[i]?.name} />
              <TextField label="Latitude" inputMode="decimal" value={r.lat} onChange={(e) => edit(i, 'lat', e.target.value)} error={errors[i]?.lat} />
              <TextField label="Longitude" inputMode="decimal" value={r.lng} onChange={(e) => edit(i, 'lng', e.target.value)} error={errors[i]?.lng} />
              <TextField label="Fare from start (Rs.)" inputMode="decimal" value={r.fareFromStart} onChange={(e) => edit(i, 'fareFromStart', e.target.value)} error={errors[i]?.fareFromStart} />
            </div>
          </li>
        ))}
      </ol>
      {errors._form && <Alert tone="danger">{errors._form}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" disabled={rows.length >= 60} onClick={() => setRows([...rows, blank()])}>Add stop</Button>
        <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save stops'}</Button>
      </div>
    </div>
  )
}
