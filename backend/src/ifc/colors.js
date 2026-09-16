import { AMBIGUOUS_FLOW_CLASSES, DEFAULT_COLOR } from './constants.js'

export const DISCIPLINE_COLORS = {
  IFCFLOWSEGMENT: [0.18, 0.53, 0.86],
  IFCFLOWFITTING: [0.12, 0.42, 0.72],
  IFCFLOWTERMINAL: [0.9, 0.9, 0.92],
  IFCPIPESEGMENT: [0.18, 0.53, 0.86],
  IFCPIPEFITTING: [0.12, 0.42, 0.72],
  IFCSANITARYTERMINAL: [0.9, 0.9, 0.92],
  IFCDUCTSEGMENT: [0.85, 0.55, 0.2],
  IFCDUCTFITTING: [0.75, 0.45, 0.15],
  IFCAIRTERMINAL: [0.95, 0.8, 0.55],
  IFCCABLECARRIERSEGMENT: [0.95, 0.75, 0.1],
  IFCCABLECARRIERFITTING: [0.85, 0.67, 0.09],
  IFCCABLESEGMENT: [0.98, 0.85, 0.3],
  IFCELECTRICAPPLIANCE: [0.9, 0.7, 0.1],
  IFCELECTRICDISTRIBUTIONBOARD: [0.88, 0.66, 0.12],
  IFCLIGHTFIXTURE: [1.0, 0.95, 0.7],
  IFCOUTLET: [0.9, 0.7, 0.1],
  IFCSWITCHINGDEVICE: [0.9, 0.7, 0.1],
  IFCFIRESUPPRESSIONTERMINAL: [0.85, 0.15, 0.15],
  IFCWALL: [0.75, 0.75, 0.78],
  IFCWALLSTANDARDCASE: [0.75, 0.75, 0.78],
  IFCSLAB: [0.65, 0.65, 0.68],
  IFCCOLUMN: [0.6, 0.62, 0.65],
  IFCBEAM: [0.58, 0.6, 0.63],
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
  IFCWINDOW: [0.4, 0.65, 0.8],
  IFCCURTAINWALL: [0.45, 0.68, 0.82],
  IFCCOVERING: [0.82, 0.8, 0.76],
  IFCFURNISHINGELEMENT: [0.7, 0.58, 0.45],
}

export const PREDEFINED_TYPE_COLORS = {
  DUCTSEGMENT: [0.85, 0.55, 0.2],
  DUCTFITTING: [0.75, 0.45, 0.15],
  PIPESEGMENT: [0.18, 0.53, 0.86],
  PIPEFITTING: [0.12, 0.42, 0.72],
  CABLESEGMENT: [0.98, 0.85, 0.3],
  CABLECARRIERSEGMENT: [0.95, 0.75, 0.1],
  AIRTERMINAL: [0.95, 0.8, 0.55],
  SANITARYTERMINAL: [0.9, 0.9, 0.92],
  FIRESUPPRESSIONTERMINAL: [0.85, 0.15, 0.15],
  LIGHTFIXTURE: [1.0, 0.95, 0.7],
  ELECTRICAPPLIANCE: [0.9, 0.7, 0.1],
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
    if (!(Math.abs(r - 0.7) < 0.02 && Math.abs(g - 0.7) < 0.02 && Math.abs(b - 0.7) < 0.02)) {
      return [round3(r), round3(g), round3(b)]
    }
  }
  return null
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

export function getProductColor(ifcClass, line, placedColor, api, modelID) {
  if (placedColor) return placedColor

  const cls = String(ifcClass || '').toUpperCase()
  const ptype = predefinedTypeOf(api, modelID, line)

  if (AMBIGUOUS_FLOW_CLASSES.has(cls)) {
    if (ptype && PREDEFINED_TYPE_COLORS[ptype]) return PREDEFINED_TYPE_COLORS[ptype]
  }

  if (DISCIPLINE_COLORS[cls]) return DISCIPLINE_COLORS[cls]

  if (ptype && PREDEFINED_TYPE_COLORS[ptype]) return PREDEFINED_TYPE_COLORS[ptype]

  return DEFAULT_COLOR
}
