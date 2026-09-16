export function sanitizeUsdName(name) {
  let sanitized = String(name).replace(/[^a-zA-Z0-9_]/g, '_')
  if (!sanitized || !/^[a-zA-Z_]/.test(sanitized)) sanitized = `_${sanitized}`
  return sanitized
}

/** Column-major 4×4 × vec3 */
export function transformPoint(m, x, y, z) {
  return {
    x: m[0] * x + m[4] * y + m[8] * z + m[12],
    y: m[1] * x + m[5] * y + m[9] * z + m[13],
    z: m[2] * x + m[6] * y + m[10] * z + m[14],
  }
}

/** IFC Z-up world → glTF Y-up (giống convert_ifc.py). */
export function ifcToYUp(x, y, z) {
  return { x, y: z, z: -y }
}

export function applyRtcAndYUp(x, y, z, rtc) {
  const vx = x - rtc[0]
  const vy = y - rtc[1]
  const vz = z - rtc[2]
  return ifcToYUp(vx, vy, vz)
}
