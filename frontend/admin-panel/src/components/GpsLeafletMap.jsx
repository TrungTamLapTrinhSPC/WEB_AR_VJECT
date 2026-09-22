import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [21.028511, 105.804817]
const DEFAULT_ZOOM = 12

const TYPE_COLOR = {
  manhole: '#F59E0B',
  pipe_junction: '#4A90E2',
  valve: '#22C55E',
  cable_box: '#8B5CF6',
}

function poiIcon(type, selected) {
  const color = TYPE_COLOR[type] || '#6B7280'
  const ring = selected ? '0 0 0 3px rgba(74,144,226,.55)' : '0 2px 6px rgba(0,0,0,.28)'
  return L.divIcon({
    className: 'gps-leaflet-marker',
    html: `<span class="gps-leaflet-diamond" style="background:${color};box-shadow:${ring}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

function MapViewport({ points, focusId, markers }) {
  const map = useMap()

  useEffect(() => {
    if (focusId) {
      const m = markers.find((g) => g.id === focusId)
      if (m) {
        const lat = Number(m.lat_wgs84)
        const lng = Number(m.lng_wgs84)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
        }
      }
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 })
      return
    }
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  }, [focusId, map, markers, points])

  return null
}

/**
 * Bản đồ Leaflet — POI GPS (zoom +/- mặc định của Leaflet).
 */
export default function GpsLeafletMap({
  markers = [],
  focusId = null,
  onMarkerClick,
  className = '',
  poiCountLabel = '',
}) {
  const validMarkers = useMemo(
    () => markers.filter((g) => {
      const lat = Number(g.lat_wgs84)
      const lng = Number(g.lng_wgs84)
      return Number.isFinite(lat) && Number.isFinite(lng)
    }),
    [markers],
  )

  const points = useMemo(
    () => validMarkers.map((g) => [Number(g.lat_wgs84), Number(g.lng_wgs84)]),
    [validMarkers],
  )

  const initialCenter = points[0] || DEFAULT_CENTER
  const initialZoom = points.length === 1 ? 15 : DEFAULT_ZOOM

  return (
    <div className={`gps-leaflet-wrap ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom
        className="gps-leaflet-map"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={points} focusId={focusId} markers={validMarkers} />
        {validMarkers.map((g) => (
          <Marker
            key={g.id}
            position={[Number(g.lat_wgs84), Number(g.lng_wgs84)]}
            icon={poiIcon(g.type, focusId === g.id)}
            eventHandlers={{
              click: () => onMarkerClick?.(g),
            }}
          >
            <Popup>
              <div className="text-[13px] font-semibold mb-1">{g.name}</div>
              <div className="text-[11px] text-text-muted font-mono">
                {Number(g.lat_wgs84).toFixed(6)}, {Number(g.lng_wgs84).toFixed(6)}
              </div>
              {g.type && (
                <div className="text-[11px] mt-1 capitalize">{g.type.replace(/_/g, ' ')}</div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {poiCountLabel ? (
        <div className="gps-leaflet-badge">
          <span className="gps-leaflet-badge-dot" /> {poiCountLabel}
        </div>
      ) : null}
    </div>
  )
}
