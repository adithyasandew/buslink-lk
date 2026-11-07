import { useEffect, useRef, useState } from 'react'
import { verifyTicket } from '../../api/staff'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { TextField } from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import PageHeader from '../../components/ui/PageHeader'

const MESSAGES = {
  TICKET_ALREADY_USED: 'Already used — this ticket has been scanned before. Do not accept it again.',
  TICKET_INVALID: 'Not recognised — this is not a BusLink ticket.',
  TICKET_NOT_VALID: 'Not valid — the booking was cancelled or is unpaid.',
  FORBIDDEN_TRIP: 'Wrong bus — this ticket is for a trip you are not assigned to.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
}
const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia

/** Camera scanning where the browser supports it (BarcodeDetector); manual entry always works. */
function Scanner({ onCode, onClose }) {
  const video = useRef(null)
  useEffect(() => {
    let stream; let stop = false
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(async (s) => {
      stream = s
      video.current.srcObject = s
      await video.current.play()
      const tick = async () => {
        if (stop) return
        const codes = await detector.detect(video.current).catch(() => [])
        if (codes[0]?.rawValue) onCode(codes[0].rawValue)
        else requestAnimationFrame(tick)
      }
      tick()
    }).catch(onClose)
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, [onCode, onClose])
  return (
    <div className="space-y-3">
      <video ref={video} muted playsInline className="aspect-square w-full rounded-2xl bg-text object-cover" aria-label="Camera preview" />
      <Button variant="secondary" className="w-full" onClick={onClose}>Stop camera</Button>
    </div>
  )
}

export default function VerifyTicketPage() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)

  const check = async (token) => {
    const value = token.trim()
    if (!value) return setResult({ ok: false, text: 'Scan a ticket or paste its code.' })
    setBusy(true)
    setResult(null)
    try {
      const t = await verifyTicket(value)
      setResult({ ok: true, ticket: t })
      setCode('')
    } catch (err) {
      setResult({ ok: false, text: MESSAGES[err.code] ?? err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Verify ticket" description="Scan the passenger’s QR code before they board." />
      {result?.ok && (
        <div role="status" className="mb-4 rounded-2xl border-2 border-success bg-success-soft p-5 text-success">
          <p className="flex items-center gap-2 text-lg font-bold"><Icon name="check" className="size-6" />Valid — let them board</p>
          <p className="mt-1 font-mono text-xl font-semibold">{result.ticket.ticketRef}</p>
          <p className="mt-1">Seat{result.ticket.seats.length > 1 ? 's' : ''} {result.ticket.seats.join(', ')}</p>
        </div>
      )}
      {result && !result.ok && <div className="mb-4"><Alert tone="danger">{result.text}</Alert></div>}

      <Card className="space-y-4">
        {scanning ? (
          <Scanner onCode={(c) => { setScanning(false); check(c) }} onClose={() => setScanning(false)} />
        ) : (
          canScan() && <Button className="w-full" onClick={() => setScanning(true)}><Icon name="scan" />Scan with camera</Button>
        )}
        <form onSubmit={(e) => { e.preventDefault(); check(code) }} className="space-y-3" noValidate>
          <TextField label="Ticket code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" hint="Paste the code from the ticket if scanning is not available" />
          <Button type="submit" variant={canScan() ? 'secondary' : 'primary'} className="w-full" disabled={busy}>{busy ? 'Checking…' : 'Check ticket'}</Button>
        </form>
      </Card>
    </div>
  )
}
