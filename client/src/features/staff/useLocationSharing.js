import { useCallback, useEffect, useRef, useState } from 'react'
import { sendLocation } from '../../api/staff'

const MIN_INTERVAL_MS = 5000 // the server also rate-limits; this keeps phone data and battery use low

/** Builds a path along the route stops for demo mode (simulated GPS, clearly labelled in the UI). */
export function simulatedPath(stops, stepsPerLeg = 12) {
  const pts = []
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i].location
    const b = stops[i + 1].location
    for (let s = 0; s < stepsPerLeg; s += 1) {
      const t = s / stepsPerLeg
      pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, accuracy: 15 })
    }
  }
  const last = stops.at(-1)?.location
  if (last) pts.push({ lat: last.lat, lng: last.lng, accuracy: 15 })
  return pts
}

/**
 * Shares the device location for one active trip.
 * mode: 'off' | 'gps' | 'demo'. Only sends while a mode is on; stops on unmount.
 */
export default function useLocationSharing(tripId, stops) {
  const [mode, setMode] = useState('off')
  const [last, setLast] = useState(null)
  const [error, setError] = useState(null)
  const lastSentAt = useRef(0)

  const push = useCallback(async (point, force = false) => {
    const now = Date.now()
    if (!force && now - lastSentAt.current < MIN_INTERVAL_MS) return
    lastSentAt.current = now
    try {
      await sendLocation(tripId, point)
      setLast({ ...point, at: new Date() })
      setError(null)
    } catch (err) {
      setError(err.message)
      if (err.code === 'TRIP_NOT_ACTIVE') setMode('off')
    }
  }, [tripId])

  useEffect(() => {
    if (mode !== 'gps') return undefined
    const id = navigator.geolocation.watchPosition(
      (p) => push({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) => {
        setError(e.code === 1 ? 'Location permission was denied. Allow it in your browser settings to share the bus position.' : 'Could not get a GPS fix. Move to an open area and try again.')
        setMode('off')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [mode, push])

  useEffect(() => {
    if (mode !== 'demo') return undefined
    const path = simulatedPath(stops)
    let i = 0
    const tick = () => {
      if (i >= path.length) { setMode('off'); return }
      push(path[i], true)
      i += 1
    }
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 3000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [mode, stops, push])

  /** Start or stop sharing; checks device support up front instead of inside an effect. */
  const change = useCallback((next) => {
    if (next === 'gps' && !navigator.geolocation) {
      setError('This device cannot share its location.')
      return
    }
    setError(null)
    setMode(next)
  }, [])

  return { mode, setMode: change, last, error }
}
