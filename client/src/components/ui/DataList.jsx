/**
 * Responsive list: cards on small screens, a table from md up.
 * columns: [{ key, label, render?(item) }]; actions?(item) renders row controls.
 */
export default function DataList({ items, columns, rowKey = (i) => i._id ?? i.id, actions }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-muted">
            <tr>
              {columns.map((c) => <th key={c.key} scope="col" className="px-4 py-3 font-medium">{c.label}</th>)}
              {actions && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={rowKey(item)} className="border-t border-border">
                {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(item) : item[c.key]}</td>)}
                {actions && <td className="px-4 py-3"><div className="flex justify-end gap-2">{actions(item)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li key={rowKey(item)} className="rounded-xl border border-border bg-surface p-4">
            <dl className="space-y-2">
              {columns.map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-4">
                  <dt className="text-sm text-muted">{c.label}</dt>
                  <dd className="text-right font-medium">{c.render ? c.render(item) : item[c.key]}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-4 flex flex-wrap gap-2">{actions(item)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}
