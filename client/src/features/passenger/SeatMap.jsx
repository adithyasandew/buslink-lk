/**
 * Bus seat grid: 2 + aisle + 2 per row. Booked seats are disabled and crossed out, selected seats are
 * pressed toggle buttons — state is never conveyed by colour alone.
 */
export default function SeatMap({ capacity, taken, selected, onToggle, max = 10 }) {
  const seats = Array.from({ length: capacity }, (_, i) => i + 1)
  const rows = []
  for (let i = 0; i < seats.length; i += 4) rows.push(seats.slice(i, i + 4))
  const atMax = selected.length >= max

  const seat = (n) => {
    const isTaken = taken.includes(n)
    const isSelected = selected.includes(n)
    const label = isTaken ? `Seat ${n}, booked` : `Seat ${n}${isSelected ? ', selected' : ''}`
    return (
      <button
        key={n}
        type="button"
        aria-label={label}
        aria-pressed={isTaken ? undefined : isSelected}
        disabled={isTaken || (!isSelected && atMax)}
        onClick={() => onToggle(n)}
        className={`grid size-11 place-items-center rounded-lg border text-sm font-semibold transition-colors ${
          isTaken ? 'cursor-not-allowed border-border bg-border/60 text-muted line-through'
            : isSelected ? 'border-primary bg-primary text-white'
              : 'border-border-strong bg-surface hover:border-primary disabled:opacity-50'
        }`}
      >
        {n}
      </button>
    )
  }

  return (
    <div>
      <div className="mx-auto w-fit rounded-2xl border border-border bg-background p-4">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">Front of bus</p>
        <div className="space-y-2" role="group" aria-label="Seats">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              {r.slice(0, 2).map(seat)}
              <span className="w-6" aria-hidden="true" />
              {r.slice(2).map(seat)}
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-muted" aria-label="Seat legend">
        <li className="flex items-center gap-2"><span className="size-4 rounded border border-border-strong bg-surface" /> Available</li>
        <li className="flex items-center gap-2"><span className="size-4 rounded bg-primary" /> Selected</li>
        <li className="flex items-center gap-2"><span className="size-4 rounded bg-border/60 line-through" /> Booked</li>
      </ul>
    </div>
  )
}
