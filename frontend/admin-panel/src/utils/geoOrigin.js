/**
 * Toán gốc toạ độ dự án — cùng công thức với backend/src/utils/projectOrigin.js
 * và `bearingFromTwoPoints` của backend app.
 *
 * Quy ước hướng trục (bearing): góc trục +X của mô hình so với hướng ĐÔNG,
 * ngược chiều kim đồng hồ, [0, 360). 0 = +X chỉ Đông, 90 = +X chỉ Bắc.
 */

const WGS84_A = 6378137
const WGS84_E2 = 6.69437999014e-3
const RAD = Math.PI / 180

function radii(latDeg) {
  const s = Math.sin(latDeg * RAD)
  const w = Math.sqrt(1 - WGS84_E2 * s * s)
  return { meridian: (WGS84_A * (1 - WGS84_E2)) / (w * w * w), primeVertical: WGS84_A / w }
}

/** (Đông, Bắc) của `p` quanh `o`, mét. */
export function localEastNorth(p, o) {
  const r = radii(o.lat)
  return {
    e: (p.lon - o.lon) * RAD * r.primeVertical * Math.cos(o.lat * RAD),
    n: (p.lat - o.lat) * RAD * r.meridian,
  }
}

export function distanceMetres(a, b) {
  const v = localEastNorth(b, a)
  return Math.hypot(v.e, v.n)
}

/** Điểm cách `o` một đoạn (Đông, Bắc) mét. */
export function offsetLatLon(o, e, n) {
  const r = radii(o.lat)
  return {
    lat: o.lat + n / r.meridian / RAD,
    lon: o.lon + e / (r.primeVertical * Math.cos(o.lat * RAD)) / RAD,
  }
}

export function normalizeBearing(deg) {
  const d = Math.round((((deg % 360) + 360) % 360) * 1e6) / 1e6
  return d >= 360 ? 0 : d
}

/** Hướng trục từ P0 (gốc) và B (điểm có toạ độ BIM `bBim`; mặc định nằm trên trục +X). */
export function bearingFromTwoPoints(p0, b, bBim = { x: 1, y: 0 }) {
  const v = localEastNorth(b, p0)
  return normalizeBearing((Math.atan2(v.n, v.e) - Math.atan2(bBim.y, bBim.x)) / RAD)
}

/**
 * Sai số hướng trục (độ) khi mỗi điểm chấm lệch `pickErrorM` mét, ở cự ly
 * P0–B là `distanceM`. Hai sai số độc lập ⟹ √2.
 */
export function bearingUncertaintyDeg(distanceM, pickErrorM = 1) {
  if (!(distanceM > 0)) return null
  return Math.atan2(Math.SQRT2 * pickErrorM, distanceM) / RAD
}

/** "21.00327, 105.84421" (chép từ Google Maps) → { lat, lon }, hoặc null. */
export function parseLatLonPair(text) {
  const m = /^\s*\(?\s*(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*\)?\s*$/.exec(String(text || ''))
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export function toNum(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
