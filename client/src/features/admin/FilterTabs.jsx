/** Segmented filter used across admin lists (a real radio group, so it works with keyboard and screen readers). */
export default function FilterTabs({ label, options, value, onChange }) {
  return (
    <fieldset className="mb-4 min-w-0">{/* fieldsets default to min-content width; min-w-0 lets the row scroll instead */}
      <legend className="sr-only">{label}</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {options.map((o) => (
          <label key={o.value} className={`relative inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl border px-4 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${value === o.value ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface text-muted hover:text-text'}`}>
            <input type="radio" name={label} className="sr-only" checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
