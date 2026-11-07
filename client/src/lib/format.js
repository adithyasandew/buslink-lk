export const money = (n) => `Rs. ${Number(n ?? 0).toLocaleString('en-LK')}`

export const tripDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const dateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const todayIso = () => new Date().toISOString().slice(0, 10)

/** Badge tones for every status shown in the passenger and staff areas (text is always shown too). */
export const STATUS_TONE = {
  pending: 'warning', confirmed: 'success', cancelled: 'neutral', rejected: 'danger',
  success: 'success', failed: 'danger', refunded: 'info',
  valid: 'success', used: 'neutral',
  scheduled: 'info', active: 'success', completed: 'neutral',
  verified: 'info', inactive: 'neutral', suspended: 'danger',
  open: 'warning', in_review: 'info', resolved: 'success',
}
