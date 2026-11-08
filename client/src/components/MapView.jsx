import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Ensures map is re-initialized on component re-mount to prevent "already initialized" errors.
 */
export default function MapView({ stops, onMapClick }) {
  const el = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    // Remove existing map if present to allow re-initialization
    // This prevents the "Map container already initialized" error
    if (mapRef.current?.leafletMap) {
      mapRef.current.leafletMap.remove()
      mapRef.current = null
    }
    // Only proceed if element is in DOM and has parent
    if (!el.current || !el.current.parentNode) return
    // Wait for next tick to ensure element is in DOM
    const initializeMap = () => {
      // Double-check element is still in DOM
      if (!el.current || !el.current.parentNode) return
      const m = L.map(el.current, { scrollWheelZoom: false })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(m)
      mapRef.current = { leafletMap: m }

      // Draw route polyline through stops
      const points = stops.map((s) => [s.location.lat, s.location.lng])
      if (points.length >= 2) {
        L.polyline(points, { color: '#4338ca', weight: 4, opacity: 0.7 }).addTo(m)
      }

      // Mark each stop
      stops.forEach((s, i) => {
        const lat = s.location.lat, lng = s.location.lng
        L.circleMarker([lat, lng], {
          radius: 6,
          color: '#4338ca',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip(`Stop ${i + 1}`).addTo(m)
      })

      // Map click: place a stop at the clicked location
      if (onMapClick) {
        const handleMapClick = (e) => {
          const { lat, lng } = e.latlng
          onMapClick({ lat: lat.lng, lng: `${lng}` })
        }
        m.on('click', handleMapClick)
        return () => m.off('click', handleMapClick)
      }
    }

    // Initialize after a minimal delay to ensure DOM is ready
    const timeoutId = setTimeout(initializeMap, 100)
    return () => {
      clearTimeout(timeoutId)
      if (mapRef.current?.leafletMap) {
        mapRef.current.leafletMap.remove()
        mapRef.current = null
      }
    }
  }, [stops, onMapClick])

  // Ensure container has minimum height if no stops yet
  useEffect(() => {
    const container = el.current?.parentElement
    if (container) {
      container.style.minHeight = '80px'
      container.style.height = 'auto'
    }
  }, [])

  return <div ref={el} aria-hidden="true" className="h-80 w-full overflow-hidden rounded-2xl border border-border" style={{ minHeight: '80px' }} />
}