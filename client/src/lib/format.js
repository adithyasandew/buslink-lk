export const money = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-LK')}`

export const tripDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Today's date (YYYY-MM-DD) in the user's local calendar. Using toISOString() here would give the UTC date,
 * which in Sri Lanka (UTC+5:30) is still "yesterday" between midnight and 05:30.
 */
export const todayIso = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Badge tones for every status shown in the passenger and staff areas (text is always shown too). */
export const STATUS_TONE = {
  pending: 'warning', confirmed: 'success', cancelled: 'neutral', rejected: 'danger',
  success: 'success', failed: 'danger', refunded: 'info',
  valid: 'success', used: 'neutral',
  scheduled: 'info', active: 'success', completed: 'neutral',
  verified: 'info', inactive: 'neutral', suspended: 'danger',
  open: 'warning', in_review: 'info', resolved: 'success',
}
