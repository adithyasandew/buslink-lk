/** Map server validation details ([{ field, message }]) to { field: message } for inline form errors. */
export function fieldErrors(err) {
  const out = {}
  for (const d of err?.details ?? []) out[d.field] = d.message
  return out
}
