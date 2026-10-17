/**
 * Gốc toạ độ dự án — điểm (0,0,0) của mô hình BIM trên thực địa.
 *
 * App iOS đọc bốn cột `projects.origin_*` (qua backend app, cùng CSDL) để đặt
 * mô hình ở chế độ AR ngoài trời:
 *   - origin_lat / origin_lon: WGS84 của điểm (0,0,0) trong mô hình (Project
 *     Base Point của Revit) — KHÔNG phải tâm toà nhà.
 *   - origin_alt: cao độ cốt ±0.000, mét.
 *   - origin_bearing_deg: góc trục +X của mô hình so với hướng ĐÔNG, ngược
 *     chiều kim đồng hồ, [0, 360). 0 = trục +X chỉ hướng Đông.
 *
 * Đường nhập ở đây là ƯỚC LƯỢNG (chấm trên bản đồ). Đường trắc địa RTK là
 * `POST /api/projects/:id/georef` của backend app, ghi bảng `project_georef`.
 */

const WGS84_A = 6378137
const WGS84_E2 = 6.69437999014e-3

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function normalizeBearing(deg) {
  const d = Math.round((((deg % 360) + 360) % 360) * 1e6) / 1e6
  // 359.9999995 làm tròn 6 chữ số thành 360 — đưa về 0 cho đúng miền [0, 360).
  return d >= 360 ? 0 : d
}

/**
 * (Đông, Bắc) của `p` quanh `o`, mét — mặt phẳng tiếp tuyến với bán kính
 * kinh tuyến/vòng thẳng đứng thật của ellipsoid. Sai < 1 cm trong vài km,
 * nhỏ hơn rất nhiều so với sai số chấm điểm trên bản đồ.
 */
export function localEastNorth(p, o) {
  const phi = (o.lat * Math.PI) / 180
  const s = Math.sin(phi)
  const w = Math.sqrt(1 - WGS84_E2 * s * s)
  const rMeridian = (WGS84_A * (1 - WGS84_E2)) / (w * w * w)
  const rPrimeVertical = WGS84_A / w
  return {
    e: (((p.lon - o.lon) * Math.PI) / 180) * rPrimeVertical * Math.cos(phi),
    n: (((p.lat - o.lat) * Math.PI) / 180) * rMeridian,
  }
}

/**
 * Hướng trục từ hai điểm: P0 = gốc, B = một điểm khác đã biết toạ độ BIM.
 * Cùng công thức `bearingFromTwoPoints` của backend app.
 *
 * `bBim` mặc định (1, 0): B nằm trên trục +X của mô hình.
 */
export function bearingFromTwoPoints(p0, b, bBim = { x: 1, y: 0 }) {
  const v = localEastNorth(b, p0)
  const deg = ((Math.atan2(v.n, v.e) - Math.atan2(bBim.y, bBim.x)) * 180) / Math.PI
  return normalizeBearing(deg)
}

/**
 * Đọc thân request `PUT /projects/:id/origin`.
 *
 * @returns {{ value?: object, errors: string[] }}
 */
export function parseOriginInput(body = {}) {
  const errors = []
  const lat = toNumber(body.origin_lat)
  const lon = toNumber(body.origin_lon)
  const alt = toNumber(body.origin_alt)
  const bearing = toNumber(body.origin_bearing_deg)

  if (lat === null) errors.push('origin_lat is required')
  else if (Number.isNaN(lat) || lat < -90 || lat > 90) errors.push('origin_lat must be between -90 and 90')

  if (lon === null) errors.push('origin_lon is required')
  else if (Number.isNaN(lon) || lon < -180 || lon > 180) errors.push('origin_lon must be between -180 and 180')

  // Cột DECIMAL(9,3): |alt| < 1 000 000. Giới hạn thực tế hơn để bắt nhập nhầm đơn vị (mm).
  if (alt !== null && (Number.isNaN(alt) || alt < -500 || alt > 9000)) {
    errors.push('origin_alt must be between -500 and 9000 metres')
  }
  if (bearing !== null && Number.isNaN(bearing)) errors.push('origin_bearing_deg must be a number')

  // (0, 0) là giá trị rỗng phổ biến nhất của form/bản đồ, không phải công trường thật.
  if (lat === 0 && lon === 0) errors.push('origin_lat/origin_lon cannot both be 0')

  if (errors.length) return { errors }
  return {
    errors,
    value: {
      origin_lat: Math.round(lat * 1e8) / 1e8,
      origin_lon: Math.round(lon * 1e8) / 1e8,
      origin_alt: alt === null ? null : Math.round(alt * 1e3) / 1e3,
      origin_bearing_deg: bearing === null ? 0 : normalizeBearing(bearing),
    },
  }
}
