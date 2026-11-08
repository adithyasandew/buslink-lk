import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops and direction.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Fixed: proper map initialization, height, and road-direction styling.
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
      if (rect.width <= 0 || rect.height <= 0) {
        // Element not visible yet, wait and try again
        setTimeout(initializeMap, 100)
        return
      }

      // Initialize Leaflet map
      const m = L.map(el.current, { scrollWheelZoom: false })

      // Add tile layer FIRST
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(m)

      // THEN set view and zoom - critical for map to display
      if (stops && stops.length > 0) {
        const firstStop = stops[0]
        const centerLat = firstStop.location.lat
        const centerLng = firstStop.location.lng
        m.setView([centerLat, centerLng], 13)
      } else {
        // Default center for Sri Lanka
        m.setView([9.0, 80.0], 7)
      }

      mapRef.current = { leafletMap: m }
      setIsReady(true)

      // Draw route direction with road-like styling
      // Use a thicker polyline with a color that resembles road directions
      const points = stops.map((s) => [s.location.lat, s.location.lng])
      if (points.length >= 2) {
        // Main route polyline - darker blue, thicker line
        L.polyline(points, {
          color: '#2c3e50',
          weight: 6,
          opacity: 0.8,
          // Use gradient simuation by adding multiple layers
        }).addTo(m)

        // Add additional visual layers to simulate road direction
        // Add a slightly lighter polyline alongside to suggest direction
        if (points.length >= 2) {
          const first = points[0]
          const last = points[points.length - 1]
          const dx = last.lng - first.lng
          const dy = last.lat - first.lat
          const length = Math.max(1, Math.sqrt(dx * dx + dy * dy))

          // Add direction arrows using circle markers at intervals
          const interval = Math.max(1, Math.floor(points.length / 4))
          for (let i = 0; i < points.length; i += interval) {
            const point = points[i]
            L.circleMarker([point[0], point[1]], {
              radius: 8,
              color: '#e67e22', // Orange color for direction
              fillColor: '#e67e22',
              fillOpacity: 0.8,
              weight: 3,
            }).bindTooltip(`Direction ${i + 1}`).addTo(m)
          }
        }
      }

      // Mark each stop
      stops.forEach((s, i) => {
        const lat = s.location.lat, lng = s.location.lng
        L.circleMarker([lat, lng], {
          radius: 6,
          color: '#2c3e50',
          fillColor: '#e74c3c',
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

    // Initial check
    initializeMap()
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
      className="rounded-2xl border border-blue-500 overflow-hidden"
      style={{ minHeight: '120px', width: '100%' }}
    />
  )
}