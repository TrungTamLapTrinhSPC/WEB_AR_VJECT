import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Icon from './Icon'
import { fetchProjectOrigin, saveProjectOrigin, clearProjectOrigin } from '../api/projects'
import {
  bearingFromTwoPoints, bearingUncertaintyDeg, distanceMetres, normalizeBearing,
  offsetLatLon, parseLatLonPair, toNum,
} from '../utils/geoOrigin'

const DEFAULT_CENTER = [21.028511, 105.804817]
/** Chiều dài mũi tên trục vẽ trên bản đồ, mét. */
const AXIS_LENGTH_M = 40
/** P0–B ngắn hơn thì hướng trục quá nhạy với sai số chấm điểm. */
const MIN_B_DISTANCE_M = 20

const TILES = {
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
}

function pinIcon(label, color) {
  return L.divIcon({
    className: 'origin-pin',
    html: `<span class="origin-pin-dot" style="background:${color}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}
const P0_ICON = pinIcon('P0', '#DC2626')
const B_ICON = pinIcon('B', '#2563EB')

function axisLabelIcon(label, color) {
  return L.divIcon({
    className: 'origin-pin',
    html: `<span class="origin-axis-tip" style="color:${color}">${label}</span>`,
    iconSize: [28, 18],
    iconAnchor: [14, 9],
  })
}
const X_LABEL_ICON = axisLabelIcon('+X', '#DC2626')
const Y_LABEL_ICON = axisLabelIcon('+Y', '#16A34A')

function fmt(n, digits) {
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

function formFromOrigin(o) {
  return {
    lat: o?.origin_lat != null ? String(Number(o.origin_lat)) : '',
    lon: o?.origin_lon != null ? String(Number(o.origin_lon)) : '',
    alt: o?.origin_alt != null ? String(Number(o.origin_alt)) : '',
    bearing: o?.origin_bearing_deg != null ? String(Number(o.origin_bearing_deg)) : '0',
  }
}

function MapClicks({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) })
  return null
}

/** Đưa bản đồ về P0 khi tải xong hoặc dán toạ độ — chỉ khi `focusKey` đổi, không theo mỗi lần kéo ghim. */
function MapFocus({ point, focusKey }) {
  const map = useMap()
  const pointRef = useRef(point)
  useEffect(() => { pointRef.current = point })
  useEffect(() => {
    const p = pointRef.current
    if (p) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 18))
  }, [focusKey, map])
  return null
}

export default function ProjectOriginPanel({ projectId, canEdit, t, toast, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState(null)
  const [survey, setSurvey] = useState(null)
  const [form, setForm] = useState(formFromOrigin(null))
  const [bPoint, setBPoint] = useState(null)
  const [bBimX, setBBimX] = useState('')
  const [bBimY, setBBimY] = useState('')
  const [pickTarget, setPickTarget] = useState('p0')
  const [tiles, setTiles] = useState('sat')
  const [saving, setSaving] = useState(false)
  const [focusKey, setFocusKey] = useState(0)
  const [loadError, setLoadError] = useState(null)

  // `initial`: lần tải đầu thay cả khung bằng "Đang tải"; tải lại sau khi lưu
  // thì giữ bản đồ (và mức zoom) đang mở.
  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true)
    try {
      const r = await fetchProjectOrigin(projectId)
      setOrigin(r)
      setSurvey(r.survey || null)
      setForm(formFromOrigin(r))
      setBPoint(null)
      setLoadError(null)
      if (initial) setFocusKey((k) => k + 1)
    } catch (err) {
      // Không hiện form trống: người dùng sẽ tưởng dự án "chưa có gốc" và nhập đè.
      if (initial) setLoadError(err.message)
      toast('err', err.message)
    } finally {
      if (initial) setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => { load({ initial: true }) }, [load])

  const lat = toNum(form.lat)
  const lon = toNum(form.lon)
  const p0 = Number.isFinite(lat) && Number.isFinite(lon)
    && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)
    ? { lat, lon } : null

  // B có toạ độ BIM: để trống cả hai = B nằm trên trục +X.
  const bBim = useMemo(() => {
    const x = toNum(bBimX)
    const y = toNum(bBimY)
    if (x === null && y === null) return { x: 1, y: 0, onAxis: true }
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, onAxis: false }
  }, [bBimX, bBimY])

  const bDistance = p0 && bPoint ? distanceMetres(p0, bPoint) : null
  const derivedBearing = p0 && bPoint && !(bBim.x === 0 && bBim.y === 0)
    ? bearingFromTwoPoints(p0, bPoint, bBim) : null
  const bearingNum = derivedBearing ?? toNum(form.bearing)
  const bearing = Number.isFinite(bearingNum) ? normalizeBearing(bearingNum) : 0
  // Khoảng cách trên bản đồ phải khớp khoảng cách BIM — lệch nhiều là chấm sai điểm hoặc sai toạ độ BIM.
  const bimDistance = bBim.onAxis || (bBim.x === 0 && bBim.y === 0) ? null : Math.hypot(bBim.x, bBim.y)
  const uncertainty = bDistance ? bearingUncertaintyDeg(bDistance, 1) : null

  // Mũi tên trục +X / +Y của mô hình đặt tại P0, theo hướng trục hiện tại.
  let axes = null
  if (p0) {
    const b = (bearing * Math.PI) / 180
    const x = offsetLatLon(p0, AXIS_LENGTH_M * Math.cos(b), AXIS_LENGTH_M * Math.sin(b))
    const y = offsetLatLon(p0, -AXIS_LENGTH_M * Math.sin(b), AXIS_LENGTH_M * Math.cos(b))
    axes = {
      x: [[p0.lat, p0.lon], [x.lat, x.lon]],
      y: [[p0.lat, p0.lon], [y.lat, y.lon]],
      xTip: [x.lat, x.lon],
      yTip: [y.lat, y.lon],
    }
  }

  const set = (k) => (e) => {
    const v = e.target.value
    if (k === 'lat' || k === 'lon') {
      const pair = parseLatLonPair(v)
      if (pair) {
        setForm((f) => ({ ...f, lat: String(pair.lat), lon: String(pair.lon) }))
        setFocusKey((n) => n + 1)
        return
      }
    }
    setForm((f) => ({ ...f, [k]: v }))
  }

  const onPick = (pt) => {
    if (!canEdit) return
    if (pickTarget === 'b') {
      setBPoint(pt)
    } else {
      setForm((f) => ({ ...f, lat: pt.lat.toFixed(8), lon: pt.lon.toFixed(8) }))
    }
  }

  const base = formFromOrigin(origin)
  const same = (a, b) => (toNum(a) ?? null) === (toNum(b) ?? null)
  const dirty = !same(form.lat, base.lat) || !same(form.lon, base.lon) || !same(form.alt, base.alt)
    || Math.abs(bearing - (toNum(base.bearing) || 0)) > 1e-6

  const handleSave = async () => {
    if (!p0) { toast('err', t('og_err_latlon')); return }
    const alt = toNum(form.alt)
    if (Number.isNaN(alt)) { toast('err', t('og_err_alt')); return }
    if (survey && !window.confirm(t('og_confirm_override'))) return
    setSaving(true)
    try {
      await saveProjectOrigin(projectId, {
        origin_lat: p0.lat,
        origin_lon: p0.lon,
        origin_alt: alt,
        origin_bearing_deg: bearing,
        override_survey: Boolean(survey),
      })
      toast('success', t('saved'))
      await load()
      onSaved?.()
    } catch (err) {
      toast('err', err.code === 'GEOREF_SURVEYED' ? t('og_confirm_override') : err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm(t('og_confirm_clear'))) return
    setSaving(true)
    try {
      await clearProjectOrigin(projectId)
      toast('success', t('deleted'))
      await load()
      onSaved?.()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-6 text-text-muted">{t('loading')}</div>
  if (loadError) {
    return (
      <div className="text-sm py-4">
        <div className="text-danger mb-2">{loadError}</div>
        <button type="button" className="btn btn-sm" onClick={() => load({ initial: true })}>
          <Icon name="refresh" size={14} /> {t('refresh')}
        </button>
      </div>
    )
  }

  const hasOrigin = origin?.origin_lat != null && origin?.origin_lon != null
  const statusChip = !hasOrigin
    ? { cls: 'chip-gray', label: t('og_status_none') }
    : survey ? { cls: 'chip-green', label: t('og_status_survey') }
      : { cls: 'chip-yellow', label: t('og_status_estimate') }
  const tile = TILES[tiles]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="card-sub font-semibold mb-0">{t('og_title')}</div>
        <span className={`chip ${statusChip.cls}`}>{statusChip.label}</span>
      </div>

      <div className="card p-3 text-[13px] leading-relaxed border border-border bg-[#F9FAFB]">
        <div className="font-bold mb-1">{t('og_help_title')}</div>
        <ol className="list-decimal pl-5 m-0 space-y-0.5 text-text-muted">
          <li>{t('og_help_1')}</li>
          <li>{t('og_help_2')}</li>
          <li>{t('og_help_3')}</li>
          <li>{t('og_help_4')}</li>
        </ol>
      </div>

      {survey && (
        <div className="card p-3 text-[13px] border border-amber-300 bg-amber-50">
          <b>{t('og_survey_title')}</b> — {t('og_survey_body')}
          {survey.survey_date ? ` (${String(survey.survey_date).slice(0, 10)}${survey.surveyor ? ` · ${survey.surveyor}` : ''})` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {canEdit && (
              <div className="flex gap-1">
                <button type="button" className={`btn btn-sm ${pickTarget === 'p0' ? 'btn-p' : ''}`} onClick={() => setPickTarget('p0')}>
                  {t('og_pick_p0')}
                </button>
                <button type="button" className={`btn btn-sm ${pickTarget === 'b' ? 'btn-p' : ''}`} onClick={() => setPickTarget('b')} disabled={!p0}>
                  {t('og_pick_b')}
                </button>
              </div>
            )}
            <div className="flex gap-1 ml-auto">
              <button type="button" className={`btn btn-sm ${tiles === 'sat' ? 'btn-p' : ''}`} onClick={() => setTiles('sat')}>{t('og_tiles_sat')}</button>
              <button type="button" className={`btn btn-sm ${tiles === 'osm' ? 'btn-p' : ''}`} onClick={() => setTiles('osm')}>{t('og_tiles_map')}</button>
            </div>
          </div>
          <div className="origin-map-wrap">
            <MapContainer
              center={p0 ? [p0.lat, p0.lon] : DEFAULT_CENTER}
              zoom={p0 ? 18 : 12}
              maxZoom={21}
              scrollWheelZoom
              className="origin-map"
            >
              <TileLayer key={tiles} url={tile.url} attribution={tile.attribution} maxNativeZoom={tile.maxNativeZoom} maxZoom={21} />
              <MapClicks onPick={onPick} />
              <MapFocus point={p0} focusKey={focusKey} />
              {axes && (
                <>
                  <Polyline positions={axes.x} pathOptions={{ color: '#DC2626', weight: 4 }} />
                  <Polyline positions={axes.y} pathOptions={{ color: '#16A34A', weight: 4 }} />
                  <Marker position={axes.xTip} icon={X_LABEL_ICON} interactive={false} />
                  <Marker position={axes.yTip} icon={Y_LABEL_ICON} interactive={false} />
                </>
              )}
              {p0 && (
                <Marker
                  position={[p0.lat, p0.lon]}
                  icon={P0_ICON}
                  draggable={canEdit}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng()
                      setForm((f) => ({ ...f, lat: ll.lat.toFixed(8), lon: ll.lng.toFixed(8) }))
                    },
                  }}
                />
              )}
              {p0 && bPoint && (
                <>
                  <Polyline positions={[[p0.lat, p0.lon], [bPoint.lat, bPoint.lon]]} pathOptions={{ color: '#2563EB', weight: 2, dashArray: '6 6' }} />
                  <Marker
                    position={[bPoint.lat, bPoint.lon]}
                    icon={B_ICON}
                    draggable={canEdit}
                    eventHandlers={{
                      dragend: (e) => {
                        const ll = e.target.getLatLng()
                        setBPoint({ lat: ll.lat, lon: ll.lng })
                      },
                    }}
                  />
                </>
              )}
            </MapContainer>
          </div>
          <div className="text-xs text-text-muted mt-1.5">{t('og_map_hint')}</div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className="form-row-grid">
            <div>
              <label className="form-label">{t('og_lat')} <span className="req">*</span></label>
              <input className="form-input font-mono" value={form.lat} onChange={set('lat')} disabled={!canEdit} placeholder="21.0032700" />
            </div>
            <div>
              <label className="form-label">{t('og_lon')} <span className="req">*</span></label>
              <input className="form-input font-mono" value={form.lon} onChange={set('lon')} disabled={!canEdit} placeholder="105.8442100" />
            </div>
          </div>
          <div className="text-xs text-text-muted -mt-1">{t('og_paste_hint')}</div>

          <div className="form-row">
            <label className="form-label">{t('og_alt')}</label>
            <input className="form-input font-mono" value={form.alt} onChange={set('alt')} disabled={!canEdit} placeholder="8.5" />
            <div className="text-xs text-text-muted mt-1">{t('og_alt_hint')}</div>
          </div>

          <div className="form-row">
            <label className="form-label">{t('og_bearing')}</label>
            <input
              className="form-input font-mono"
              value={derivedBearing != null ? fmt(derivedBearing, 3) : form.bearing}
              onChange={set('bearing')}
              disabled={!canEdit || derivedBearing != null}
              placeholder="0"
            />
            <div className="text-xs text-text-muted mt-1">
              {derivedBearing != null ? t('og_bearing_from_b') : t('og_bearing_hint')}
            </div>
            {bearing === 0 && <div className="text-xs text-amber-700 mt-1">{t('og_bearing_zero')}</div>}
          </div>

          {canEdit && p0 && (
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-text-muted uppercase">{t('og_b_title')}</div>
              {!bPoint ? (
                <div className="text-xs text-text-muted">{t('og_b_empty')}</div>
              ) : (
                <>
                  <div className="text-xs font-mono">
                    B: {fmt(bPoint.lat, 7)}, {fmt(bPoint.lon, 7)} · P0–B {fmt(bDistance, 1)} m
                  </div>
                  {uncertainty != null && (
                    <div className="text-xs text-text-muted">{t('og_b_uncertainty').replace('{deg}', fmt(uncertainty, 1))}</div>
                  )}
                  {bDistance < MIN_B_DISTANCE_M && <div className="text-xs text-amber-700">{t('og_b_too_close')}</div>}
                  <div className="form-row-grid">
                    <div>
                      <label className="form-label">{t('og_b_bim_x')}</label>
                      <input className="form-input font-mono" value={bBimX} onChange={(e) => setBBimX(e.target.value)} placeholder="—" />
                    </div>
                    <div>
                      <label className="form-label">{t('og_b_bim_y')}</label>
                      <input className="form-input font-mono" value={bBimY} onChange={(e) => setBBimY(e.target.value)} placeholder="—" />
                    </div>
                  </div>
                  <div className="text-xs text-text-muted">{t('og_b_bim_hint')}</div>
                  {bimDistance != null && bDistance != null && Math.abs(bimDistance - bDistance) > Math.max(3, 0.1 * bimDistance) && (
                    <div className="text-xs text-amber-700">
                      {t('og_b_mismatch')} ({fmt(bDistance, 1)} m / {fmt(bimDistance, 1)} m)
                    </div>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => { setForm((f) => ({ ...f, bearing: fmt(bearing, 6) })); setBPoint(null) }}>
                    {t('og_b_remove')}
                  </button>
                </>
              )}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn btn-p" onClick={handleSave} disabled={saving || !p0 || !dirty}>
                <Icon name="check" size={14} /> {saving ? '...' : t('save')}
              </button>
              <button type="button" className="btn" onClick={() => load()} disabled={saving || !dirty}>{t('cancel')}</button>
              {hasOrigin && (
                <button type="button" className="btn ml-auto text-danger" onClick={handleClear} disabled={saving}>
                  {t('og_clear')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
