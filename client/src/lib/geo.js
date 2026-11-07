const R = 6371000
const rad = (d) => (d * Math.PI) / 180

/** Great-circle distance in metres (display only; the server makes all decisions). */
export function distanceMeters(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const formatDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

export function nearestStop(stops, point) {
  let best = null
  for (const s of stops) {
    const d = distanceMeters(point, s.location)
    if (!best || d < best.distance) best = { stop: s, distance: d }
  }
  return best
}
