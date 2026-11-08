import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Fixed: ensures map initializes only after DOM is ready and container has proper height.
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

    // Wait for element to be in DOM
    const checkElement = () => {
      if (!el.current || !el.current.parentNode) return
      const rect = el.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        // Element has zero size, wait and try again
        setTimeout(checkElement, 100)
        return
      }
      // Initialize map only when element has proper size
      initializeMap()
    }

    // Check on mount and on resize
    checkElement()
    window.addEventListener('resize', checkElement)

    return () => {
      window.removeEventListener('resize', checkElement)
      if (mapRef.current?.leafletMap) {
        mapRef.current.leafletMap.remove()
        mapRef.current = null
        setIsReady(false)
      }
    }
  }, [stops, onMapClick])

  useEffect(() => {
    if (isReady && mapRef.current?.leafletMap) {
      // Ensure map fits its container
      const map = mapRef.current.leafletMap
      const container = map.getContainer()
      if (container) {
        container.style.width = '100%'
        container.style.height = '100%'
      }
    }
  }, [isReady])

  const initializeMap = () => {
    if (!el.current || !el.current.parentNode) return

    const m = L.map(el.current, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m)

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

  // Ensure container has proper minimum height
  useEffect(() => {
    const container = el.current?.parentElement
    if (container) {
      // Set minimum height based on available space
      const rect = el.current.getBoundingClientRect()
      container.style.minHeight = rect.height > 0 ? `${rect.height}px` : '80px'
      container.style.height = 'auto'
    }
  }, [el.current])

  return (
    <div
      ref={el}
      aria-hidden="true"
      className="rounded-2xl border border-border overflow-hidden"
      style={{ minHeight: '80px', width: '100%' }}
    />
  )
}