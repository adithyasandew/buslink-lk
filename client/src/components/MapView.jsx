import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map of a route with the live bus position.
 * Decorative for assistive tech: the page always provides the same information as text.
 */
export default function MapView({ stops, bus, pickup }) {
  const el = useRef(null)
  const map = useRef(null)
  const busMarker = useRef(null)

  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)
    const points = stops.map((s) => [s.location.lat, s.location.lng])
    L.polyline(points, { color: '#4338ca', weight: 4, opacity: 0.7 }).addTo(m)
    stops.forEach((s) => L.circleMarker([s.location.lat, s.location.lng], { radius: 6, color: '#4338ca', fillColor: '#fff', fillOpacity: 1, weight: 2 }).bindTooltip(s.name).addTo(m))
    if (pickup) L.circleMarker([pickup.lat, pickup.lng], { radius: 9, color: '#15803d', fillColor: '#dcfce7', fillOpacity: 1, weight: 3 }).bindTooltip('Your pickup').addTo(m)
    m.fitBounds(points, { padding: [24, 24] })
    map.current = m
    return () => { m.remove(); map.current = null; busMarker.current = null }
  }, [stops, pickup])

  useEffect(() => {
    if (!map.current || !bus) return
    const ll = [bus.lat, bus.lng]
    if (!busMarker.current) {
      const icon = L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:9999px;background:#4338ca;border:3px solid #fff;box-shadow:0 0 0 4px rgba(67,56,202,.25)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
      busMarker.current = L.marker(ll, { icon, title: 'Bus' }).addTo(map.current)
    } else {
      busMarker.current.setLatLng(ll)
    }
    map.current.panTo(ll, { animate: true })
  }, [bus])

  return <div ref={el} aria-hidden="true" className="h-72 w-full overflow-hidden rounded-2xl border border-border sm:h-96" />
}
