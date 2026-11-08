import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Fixed: aria-hidden removal, proper map initialization, and height.
 */
export default function MapView({ stops, onMapClick }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Remove existing map if present to allow re-initialization
    if (mapRef.current?.leafletMap) {
      mapRef.current.leafletMap.remove()
      mapRef.current = null
      setIsReady(false)
    }

    // Wait for element to be in DOM with proper dimensions
    const initializeMap = () => {
      if (!el.current || !el.current.parentNode) return

      const rect = el.current.getBoundingClientRect()
      // Element must have non-zero dimensions to initialize Leaflet
      if (rect.width <= 0 || rect.height <= 0) {
        // Element not visible yet, wait and try again
        setTimeout(initializeMap, 50)
        return
      }

      // Initialize Leaflet map
      const m = L.map(el.current, { scrollWheelZoom: false })

      // Add tile layer FIRST (critical - must be before setView)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(m)

      // THEN set view and zoom - this is the critical step that prevents "Set map center and zoom first" error
      if (stops && stops.length > 0) {
        const firstStop = stops[0]
        const centerLat = firstStop.location.lat
        const centerLng = firstStop.location.lng
        m.setView([centerLat, centerLng], 14)
      } else {
        // Default center for Sri Lanka
        m.setView([9.0, 80.0], 7)
      }

      mapRef.current = { leafletMap: m }
      setIsReady(true)

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

    // Initial check - wait one tick for DOM
    setTimeout(initializeMap, 100)
  }, [stops, onMapClick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current?.leafletMap) {
        mapRef.current.leafletMap.remove()
        mapRef.current = null
        setIsReady(false)
      }
    }
  }, [])

  // Ensure container has proper minimum height
  useEffect(() => {
    const container = el.current?.parentElement
    if (container) {
      const rect = el.current.getBoundingClientRect()
      container.style.minHeight = rect.height > 0 ? `${rect.height}px` : '120px'
      container.style.height = 'auto'
    }
  }, [el.current])

  return (
    <div
      ref={el}
      aria-hidden="false"
      className="rounded-2xl border border-border overflow-hidden"
      style={{ minHeight: '120px', width: '100%' }}
    />
  )
}