import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Leaflet + OpenStreetMap map displaying route stops with road-based routing.
 * Decorative for assistive tech: the page always provides the same information as text.
 * Map click handler is provided via onMapClick prop when needed.
 * Integrated OSRM routing for actual road-based route visualization.
 */
export default function MapView({ stops, onMapClick, onFocusStop }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [isRouting, setIsRouting] = useState(false)
  const [routeError, setRouteError] = useState(null)

  useEffect(() => {
    // Remove existing map if present to allow re-initialization
    if (mapRef.current?.leafletMap) {
      mapRef.current.leafletMap.remove()
      mapRef.current = null
      setIsReady(false)
      setIsRouting(false)
      setRouteError(null)
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

      // Initialize Leaflet map ONLY if not already initialized
      if (!mapRef.current?.leafletMap) {
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
      }

      // Calculate and draw routes between consecutive stops
      calculateRoutes()
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
        setIsRouting(false)
        setRouteError(null)
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

  // Calculate and draw routes between consecutive stops using OSRM
  const calculateRoutes = () => {
    if (!mapRef.current || stops.length < 2) {
      setIsRouting(false)
      return
    }

    setIsRouting(true)
    setRouteError(null)

    // Clear old route layers
    mapRef.current.leafletMap.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        if (layer.options && layer.options.routeId) {
          mapRef.current.leafletMap.removeLayer(layer)
        }
      }
    })

    // Request routes between consecutive stops using IIFE
    ;(async () => {
      const coordinatesList = stops.map((s) => [
        parseFloat(s.location.lng),
        parseFloat(s.location.lat),
      ])

      const routes = []
      for (let i = 0; i < stops.length - 1; i++) {
        const startCoord = coordinatesList[i].join(',')
        const endCoord = coordinatesList[i + 1].join(',')

        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${startCoord};${endCoord}?overview=full&geometries=geojson`
          )

          if (!response.ok) {
            throw new Error(`OSRM error: ${response.status}`)
          }

          const data = await response.json()
          if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found')
          }

          routes.push({
            coordinates: data.routes[0].geometry.coordinates,
            name: `${stops[i].name} → ${stops[i + 1].name}`,
          })
        } catch (error) {
          console.error('OSRM routing error:', error)
          setRouteError(
            error.message || 'Failed to calculate route between stops'
          )
        }
      }

      // Draw each route on the map
      if (routes && routes.length > 0) {
        routes.forEach((route, routeIndex) => {
          const latlngs = route.coordinates.map((coord) => [
            coord[1], // latitude
            coord[0], // longitude
          ])

          const polyline = L.polyline(latlngs, {
            color: routeIndex === 0 ? '#1a73e8' : '#ff8c00', // Blue for first, orange for subsequent
            weight: 5,
            opacity: 0.8,
            routeId: `route-${routeIndex}`, // For cleanup
          }).addTo(mapRef.current.leafletMap)

          // Add stop markers along the route
          const routeStops = stops.slice(routeIndex, routeIndex + 2)
          routeStops.forEach((stop, stopIndex) => {
            const lat = stop.location.lat
            const lng = stop.location.lng
            L.marker([lat, lng], {
              title: `Stop ${stopIndex + 1}`,
              riseOnHover: true,
            })
              .bindTooltip(` ${stop.name}`)
              .addTo(mapRef.current.leafletMap)
          })
        })
      }

      setIsRouting(false)
    })()
  }

  useEffect(() => {
    // Handle focus stop - center map on specific stop
    if (!isReady || !mapRef.current || !onFocusStop) return

    const map = mapRef.current.leafletMap

    // Center on first stop by default when map is ready
    if (stops && stops.length > 0) {
      const firstStop = stops[0]
      map.setView([firstStop.location.lat, firstStop.location.lng], 14)
      onFocusStop(firstStop.location.lat, firstStop.location.lng)
    }
  }, [isReady, stops, onFocusStop])

  useEffect(() => {
    // Only run once after map is ready
    if (!isReady || !mapRef.current) return

    // Fit map bounds to show all route markers
    const map = mapRef.current.leafletMap
    const bounds = L.latLngBounds()

    // Add all stop markers to bounds
    // We'll fit after a tick to ensure markers are rendered
    setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          bounds.extend(layer.getLatLng())
        }
      })

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50],
        })
      }
    }, 300)
  }, [isReady, stops])

  // Effect to handle map click for adding stops
  useEffect(() => {
    if (!mapRef.current || !onMapClick) return

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng
      onMapClick({ lat: lat.lng, lng: `${lng}` })
    }
    mapRef.current.leafletMap.on('click', handleMapClick)
    return () => mapRef.current.leafletMap.off('click', handleMapClick)
  }, [onMapClick])

  return (
    <div
      ref={el}
      aria-hidden="false"
      className="rounded-2xl border border-border overflow-hidden"
      style={{ minHeight: '480px', width: '100%' }}
    />
  )
}