import { AMBIGUOUS_FLOW_CLASSES, DEFAULT_COLOR } from './constants.js'

export const DISCIPLINE_COLORS = {
  IFCFLOWSEGMENT: [0.18, 0.53, 0.86],
  IFCFLOWFITTING: [0.12, 0.42, 0.72],
  IFCFLOWTERMINAL: [0.9, 0.9, 0.92],
  IFCPIPESEGMENT: [0.05, 0.75, 0.88],
  IFCPIPEFITTING: [0.12, 0.42, 0.72],
  IFCSANITARYTERMINAL: [0.9, 0.9, 0.92],
  IFCDUCTSEGMENT: [0.98, 0.85, 0.22],
  IFCDUCTFITTING: [0.75, 0.45, 0.15],
  IFCAIRTERMINAL: [0.95, 0.8, 0.55],
  IFCCABLECARRIERSEGMENT: [0.95, 0.75, 0.1],
  IFCCABLECARRIERFITTING: [0.85, 0.67, 0.09],
  IFCCABLESEGMENT: [0.98, 0.45, 0.15],
  IFCELECTRICAPPLIANCE: [0.9, 0.7, 0.1],
  IFCELECTRICDISTRIBUTIONBOARD: [0.88, 0.66, 0.12],
  IFCLIGHTFIXTURE: [1.0, 0.95, 0.7],
  IFCOUTLET: [0.9, 0.7, 0.1],
  IFCSWITCHINGDEVICE: [0.9, 0.7, 0.1],
  IFCFIRESUPPRESSIONTERMINAL: [1.0, 0.15, 0.15],
  IFCWALL: [0.88, 0.86, 0.80],
  IFCWALLSTANDARDCASE: [0.88, 0.86, 0.80],
  IFCSLAB: [0.75, 0.78, 0.82],
  IFCCOLUMN: [0.16, 0.45, 0.90],
  IFCBEAM: [0.98, 0.58, 0.16],
  IFCFOOTING: [0.52, 0.54, 0.57],
  IFCPILE: [0.5, 0.52, 0.55],
  IFCMEMBER: [0.58, 0.6, 0.63],
  IFCPLATE: [0.62, 0.64, 0.67],
  IFCRAMP: [0.68, 0.68, 0.71],
  IFCSTAIR: [0.68, 0.68, 0.71],
  IFCSTAIRFLIGHT: [0.68, 0.68, 0.71],
  IFCRAILING: [0.55, 0.57, 0.6],
  IFCROOF: [0.6, 0.45, 0.4],
  IFCREINFORCINGBAR: [0.85, 0.42, 0.22],
  IFCREINFORCINGMESH: [0.8, 0.4, 0.2],
  IFCTENDON: [0.7, 0.35, 0.18],
  IFCTENDONANCHOR: [0.62, 0.3, 0.15],
  IFCDOOR: [0.55, 0.35, 0.2],
  IFCWINDOW: [0.35, 0.82, 0.95],
  IFCCURTAINWALL: [0.35, 0.82, 0.95],
  IFCCOVERING: [0.82, 0.8, 0.76],
  IFCFURNISHINGELEMENT: [0.7, 0.58, 0.45],
  IFCBUILDINGELEMENTPROXY: [0.65, 0.67, 0.70],
}

export const PREDEFINED_TYPE_COLORS = {
  DUCTSEGMENT: [0.98, 0.85, 0.22],
  DUCTFITTING: [0.75, 0.45, 0.15],
  PIPESEGMENT: [0.05, 0.75, 0.88],
  PIPEFITTING: [0.12, 0.42, 0.72],
  CABLESEGMENT: [0.98, 0.45, 0.15],
  CABLECARRIERSEGMENT: [0.95, 0.75, 0.1],
  AIRTERMINAL: [0.95, 0.8, 0.55],
  SANITARYTERMINAL: [0.9, 0.9, 0.92],
  FIRESUPPRESSIONTERMINAL: [1.0, 0.15, 0.15],
  LIGHTFIXTURE: [1.0, 0.95, 0.7],
  ELECTRICAPPLIANCE: [0.9, 0.7, 0.1],
}

export const FIRE_PROTECTION_COLOR = [1.0, 0.165, 0.165] // #FF2A2A
export const LOUVER_COLOR = [0.38, 0.40, 0.44] // Metallic / charcoal louver slats
export const SUNSHADE_COLOR = [0.50, 0.53, 0.58] // Architectural sunshade fins

export function isLouverElement(ifcClass, line) {
  const checkText = (text) => {
    if (!text || typeof text !== 'string') return false
    const lower = text.toLowerCase()
    return (
      lower.includes('chớp')
      || lower.includes('chop')
      || lower.includes('ch\u1edbp')
      || lower.includes('ch\u00f3p')
      || lower.includes('louver')
      || lower.includes('shutter')
      || lower.includes('louvre')
    )
  }
  if (checkText(ifcClass)) return true
  const name = line?.Name?.value ?? line?.Name
  if (checkText(name)) return true
  const objType = line?.ObjectType?.value ?? line?.ObjectType
  if (checkText(objType)) return true
  const desc = line?.Description?.value ?? line?.Description
  if (checkText(desc)) return true
  return false
}

export function isSunshadeElement(ifcClass, line) {
  const checkText = (text) => {
    if (!text || typeof text !== 'string') return false
    const lower = text.toLowerCase()
    return (
      lower.includes('chắn nắng')
      || lower.includes('chan nang')
      || lower.includes('sunshade')
      || lower.includes('shading')
      || lower.includes('brise-soleil')
    )
  }
  if (checkText(ifcClass)) return true
  const name = line?.Name?.value ?? line?.Name
  if (checkText(name)) return true
  const objType = line?.ObjectType?.value ?? line?.ObjectType
  if (checkText(objType)) return true
  const desc = line?.Description?.value ?? line?.Description
  if (checkText(desc)) return true
  return false
}

export function isFireProtectionElement(ifcClass, line, api, modelID) {
  const checkText = (text) => {
    if (!text || typeof text !== 'string') return false
    const lower = text.toLowerCase()
    return lower.includes('fire') || lower.includes('sprinkler') || lower.includes('pccc')
  }

  if (checkText(ifcClass)) return true

  const name = line?.Name?.value ?? line?.Name
  if (checkText(name)) return true
  const objType = line?.ObjectType?.value ?? line?.ObjectType
  if (checkText(objType)) return true
  const desc = line?.Description?.value ?? line?.Description
  if (checkText(desc)) return true
  const tag = line?.Tag?.value ?? line?.Tag
  if (checkText(tag)) return true

  try {
    const isDefinedBy = line?.IsDefinedBy
    if (Array.isArray(isDefinedBy) && api && modelID !== undefined) {
      for (const relRef of isDefinedBy) {
        const rel = typeof relRef === 'number' ? api.GetLine(modelID, relRef) : relRef
        if (!rel?.type) continue
        if (api.GetNameFromTypeCode(rel.type) !== 'IfcRelDefinesByType') continue
        const typeRef = rel.RelatingType
        const typeLine = typeof typeRef === 'number' ? api.GetLine(modelID, typeRef) : typeRef
        const tName = typeLine?.Name?.value ?? typeLine?.Name
        if (checkText(tName)) return true
        const tObjType = typeLine?.ElementType?.value ?? typeLine?.ElementType ?? typeLine?.ObjectType?.value ?? typeLine?.ObjectType
        if (checkText(tObjType)) return true
      }
    }
  } catch {
    /* ignore */
  }

  return false
}

function readPredefinedTypeValue(ptype) {
  if (!ptype || ptype === 'NOTDEFINED' || ptype === 'USERDEFINED') return null
  return String(ptype).toUpperCase()
}

/** Giống `predefined_type_of()` trong converter_core.py — ưu tiên IfcRelDefinesByType. */
export function predefinedTypeOf(api, modelID, line) {
  try {
    const isDefinedBy = line?.IsDefinedBy
    if (Array.isArray(isDefinedBy)) {
      for (const relRef of isDefinedBy) {
        const rel = typeof relRef === 'number' ? api.GetLine(modelID, relRef) : relRef
        if (!rel?.type) continue
        if (api.GetNameFromTypeCode(rel.type) !== 'IfcRelDefinesByType') continue
        const typeRef = rel.RelatingType
        const typeLine = typeof typeRef === 'number' ? api.GetLine(modelID, typeRef) : typeRef
        const fromType = readPredefinedTypeValue(typeLine?.PredefinedType?.value ?? typeLine?.PredefinedType)
        if (fromType) return fromType
      }
    }
  } catch {
    /* ignore */
  }

  try {
    return readPredefinedTypeValue(line?.PredefinedType?.value ?? line?.PredefinedType)
  } catch {
    return null
  }
}

export function colorFromPlacedGeometry(placed) {
  const c = placed?.color
  if (c && typeof c.x === 'number') {
    const r = c.x
    const g = c.y
    const b = c.z
    const alpha = typeof c.w === 'number' ? round3(c.w) : 1.0
    if (alpha < 0.99) {
      return [round3(r), round3(g), round3(b), alpha]
    }
    return [round3(r), round3(g), round3(b)]
  }
  return null
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

/**
 * Convert RGB [0..1] to HSL [0..1]
 */
export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return [h, s, l]
}

/**
 * Convert HSL [0..1] to RGB [0..1]
 */
export function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p, q, t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)
  return [r, g, b]
}

/**
 * Nâng độ sáng và độ tươi màu cho mô hình 3D trong không gian PBR (AR / WebGL):
 * - Lightness curve: nâng sáng vùng tối và midtones (L^0.82 * 1.08) để gạch, cốt thép, bê tông không bị tối đen.
 * - Saturation boost: tăng độ rực (+25%) cho các màu có sắc độ (S > 0.05), giữ nguyên màu xám trung tính.
 * - Alpha preservation: giữ nguyên độ trong suốt (kính).
 */
export function enhanceColorVibrancy(color, options = {}) {
  if (!Array.isArray(color) || color.length < 3) return color
  const [r, g, b] = color
  const alpha = color.length > 3 ? color[3] : undefined
  const [h, s, l] = rgbToHsl(r, g, b)

  const lightnessPower = options.lightnessPower ?? 0.82
  const lightnessScale = options.lightnessScale ?? 1.08
  const newL = Math.min(1.0, Math.pow(Math.max(0, l), lightnessPower) * lightnessScale)

  const saturationBoost = options.saturationBoost ?? 1.25
  const newS = s > 0.05 ? Math.min(1.0, s * saturationBoost) : s

  const [nr, ng, nb] = hslToRgb(h, newS, newL)
  if (alpha !== undefined) {
    return [round3(nr), round3(ng), round3(nb), alpha]
  }
  return [round3(nr), round3(ng), round3(nb)]
}

export function getProductColor(ifcClass, line, placedColor, api, modelID, options = {}) {
  let resolved = null

  // 1. Nếu là hệ thống cứu hỏa hoặc ống chữa cháy (kiểm tra tên cấu kiện có chứa Fire, Sprinkler, PCCC), ưu tiên gán màu đỏ tươi #FF2A2A
  if (isFireProtectionElement(ifcClass, line, api, modelID)) {
    resolved = FIRE_PROTECTION_COLOR
  } else if (isLouverElement(ifcClass, line) && (!placedColor || (placedColor[0] > 0.98 && placedColor[1] > 0.98 && placedColor[2] > 0.98))) {
    // 2. Cửa chớp / louver / shutter: nếu không có màu hoặc màu trắng mặc định (1.0, 1.0, 1.0) từ CAD/Revit
    resolved = LOUVER_COLOR
  } else if (isSunshadeElement(ifcClass, line) && (!placedColor || (placedColor[0] > 0.98 && placedColor[1] > 0.98 && placedColor[2] > 0.98))) {
    // 3. Chắn nắng / sunshade
    resolved = SUNSHADE_COLOR
  } else {
    const cls = String(ifcClass || '').toUpperCase()

    // 4. Kiểm tra tùy chọn ghi đè theo bảng màu chuẩn (overrideDisciplineColors)
    // Hỗ trợ: true (ghi đè tất cả), array (['IfcBeam', 'IfcSlab']), chuỗi 'IfcBeam,IfcSlab' hoặc object { IfcBeam: true }
    const overrideOpt = options?.overrideDisciplineColors
    let shouldOverride = false
    if (overrideOpt === true) {
      shouldOverride = true
    } else if (Array.isArray(overrideOpt)) {
      shouldOverride = overrideOpt.some((item) => String(item).toUpperCase() === cls)
    } else if (typeof overrideOpt === 'string' && overrideOpt.trim()) {
      const list = overrideOpt.split(',').map((s) => s.trim().toUpperCase())
      shouldOverride = list.includes(cls) || list.includes('TRUE') || list.includes('1') || list.includes('ALL')
    } else if (overrideOpt && typeof overrideOpt === 'object') {
      shouldOverride = Boolean(overrideOpt[cls] || overrideOpt[ifcClass])
    }

    // Lưu ý: Nếu placedColor là kính trong suốt (alpha < 0.99), TUYỆT ĐỐI KHÔNG ghi đè thành màu đặc (opaque)
    const isGlass = placedColor && placedColor.length > 3 && placedColor[3] < 0.99

    if (shouldOverride && !isGlass) {
      const ptype = predefinedTypeOf(api, modelID, line)
      if (AMBIGUOUS_FLOW_CLASSES.has(cls) && ptype && PREDEFINED_TYPE_COLORS[ptype]) {
        resolved = PREDEFINED_TYPE_COLORS[ptype]
      } else if (DISCIPLINE_COLORS[cls]) {
        resolved = DISCIPLINE_COLORS[cls]
      } else if (ptype && PREDEFINED_TYPE_COLORS[ptype]) {
        resolved = PREDEFINED_TYPE_COLORS[ptype]
      }
    }

    // 5. Khi file IFC có chứa vật liệu màu thật từ Revit (m.diffuse), giữ nguyên màu này nếu chưa bị override
    if (!resolved) {
      if (placedColor) {
        resolved = placedColor
      } else {
        const ptype = predefinedTypeOf(api, modelID, line)
        if (AMBIGUOUS_FLOW_CLASSES.has(cls) && ptype && PREDEFINED_TYPE_COLORS[ptype]) {
          resolved = PREDEFINED_TYPE_COLORS[ptype]
        } else if (DISCIPLINE_COLORS[cls]) {
          resolved = DISCIPLINE_COLORS[cls]
        } else if (ptype && PREDEFINED_TYPE_COLORS[ptype]) {
          resolved = PREDEFINED_TYPE_COLORS[ptype]
        } else {
          resolved = DEFAULT_COLOR
        }
      }
    }
  }

  // 6. Đẩy màu tươi sáng (boostColorVibrancy) nếu được kích hoạt trong options
  const shouldBoost = Boolean(options?.boostColorVibrancy ?? options?.boost_color_vibrancy ?? options?.enhanceVibrancy)
  if (shouldBoost && resolved) {
    return enhanceColorVibrancy(resolved, options)
  }

  return resolved
}
