import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops and direction.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Fixed: proper map height, road-direction styling, and initialization.
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

      // THEN set view and zoom - this was the missing step
      // Center on the first stop with appropriate zoom
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

      // Draw main route polyline - thicker, road-like style
      // Main route: thick blue line emphasizing the route
      const points = stops.map((s) => [s.location.lat, s.location.lng])
      if (points.length >= 2) {
        // Main route polyline - emphasized road
        L.polyline(points, {
          color: '#1a73e8', // Google Maps blue
          weight: 6,        // Thicker line
          opacity: 0.9,
          // No dashArray - solid line like a main road
        }).addTo(m)
      }

      // Add direction markers along the route to show direction
      // Small orange markers at intervals to indicate direction of travel
      if (stops && stops.length >= 2) {
        const interval = Math.max(1, Math.floor(stops.length / 4))
        for (let i = 0; i < stops.length; i += interval) {
          const stop = stops[i]
          L.circleMarker([stop.location.lat, stop.location.lng], {
            radius: 6,
            color: '#ff8c00', // Orange direction color
            fillColor: '#ff8c00',
            fillOpacity: 1,
            weight: 2,
          }).bindTooltip(`Direction ${i + 1}`).addTo(m)
        }
      }

      // Mark each stop
      stops.forEach((s, i) => {
        const lat = s.location.lat, lng = s.location.lng
        L.circleMarker([lat, lng], {
          radius: 5,
          color: '#1a73e8',
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip(`Stop ${i + 1} `).addTo(m)
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

  // Ensure container has proper minimum height - this effect runs after render
  useEffect(() => {
    const container = el.current?.parentElement
    if (container) {
      // Set min-height based on available space, but don't override explicit heights
      const rect = el.current.getBoundingClientRect()
      if (rect.height > 0) {
        container.style.minHeight = `${rect.height}px`
      } else {
        // Fallback minimum height
        container.style.minHeight = '120px'
      }
      // Don't set fixed height - let it flow naturally
      container.style.height = 'auto'
    }
  }, [el.current])

  return (
    <div
      ref={el}
      aria-hidden="false"
      className="rounded-xl border border-border overflow-hidden"
      style={{ width: '100%' }}
    />
  )
}