import { IFCRELDEFINESBYPROPERTIES, IFCRELDEFINESBYTYPE } from 'web-ifc'
import { SPATIAL_CLASSES } from './constants.js'

function getRawValue(val) {
  if (val === undefined || val === null) return null
  if (typeof val === 'object') {
    if (val.value !== undefined) return val.value
    if (val._representationValue !== undefined) return val._representationValue
    if (val._internalValue !== undefined) return val._internalValue
    return null
  }
  return val
}

export function readPropValue(prop) {
  try {
    if (!prop) return null

    // 1. IfcPropertySingleValue
    if (prop.NominalValue !== undefined && prop.NominalValue !== null) {
      const v = getRawValue(prop.NominalValue)
      return v !== null ? String(v) : null
    }

    // 2. IfcPropertyEnumeratedValue
    if (prop.EnumerationValues) {
      const arr = Array.isArray(prop.EnumerationValues) ? prop.EnumerationValues : [prop.EnumerationValues]
      const items = arr.map(getRawValue).filter((v) => v !== null && v !== undefined)
      if (items.length) return items.join(', ')
    }

    // 3. IfcPropertyListValue
    if (prop.ListValues) {
      const arr = Array.isArray(prop.ListValues) ? prop.ListValues : [prop.ListValues]
      const items = arr.map(getRawValue).filter((v) => v !== null && v !== undefined)
      if (items.length) return items.join(', ')
    }

    // 4. IfcPropertyBoundedValue
    if (prop.LowerBoundValue || prop.UpperBoundValue) {
      const low = getRawValue(prop.LowerBoundValue) ?? ''
      const up = getRawValue(prop.UpperBoundValue) ?? ''
      return `${low} .. ${up}`.trim()
    }

    // 5. IfcElementQuantity (Length, Area, Volume, Count, Weight, Time)
    const qVal = prop.LengthValue ?? prop.AreaValue ?? prop.VolumeValue
      ?? prop.CountValue ?? prop.WeightValue ?? prop.TimeValue
    if (qVal !== undefined && qVal !== null) {
      const v = getRawValue(qVal)
      if (v !== null) {
        const unitName = prop.Unit?.Name?.value ?? prop.Unit?.Name
        return unitName ? `${v} ${unitName}` : String(v)
      }
    }

    return null
  } catch {
    return null
  }
}

export function buildPropertyIndices(api, modelID) {
  const elementToPsetIds = new Map()
  const elementToTypeId = new Map()

  // 1. Index IfcRelDefinesByProperties (cấu kiện -> property sets / element quantities)
  try {
    const relPropsCode = typeof IFCRELDEFINESBYPROPERTIES === 'number'
      ? IFCRELDEFINESBYPROPERTIES
      : (api.GetTypeCodeFromName?.('IfcRelDefinesByProperties') ?? 4186316022)
    const relProps = api.GetLineIDsWithType(modelID, relPropsCode)
    const size = relProps.size()
    for (let i = 0; i < size; i += 1) {
      const relId = relProps.get(i)
      const rel = api.GetLine(modelID, relId)
      if (!rel) continue

      const pdef = rel.RelatingPropertyDefinition
      const pdefId = typeof pdef === 'object' && pdef !== null ? pdef.value : pdef
      if (!pdefId) continue

      const relObjs = rel.RelatedObjects
      const objs = Array.isArray(relObjs) ? relObjs : [relObjs]
      for (const obj of objs) {
        const objId = typeof obj === 'object' && obj !== null ? obj.value : obj
        if (!objId) continue
        let list = elementToPsetIds.get(objId)
        if (!list) {
          list = []
          elementToPsetIds.set(objId, list)
        }
        list.push(pdefId)
      }
    }
  } catch (err) {
    console.warn('[ifc-metadata] Warning indexing IfcRelDefinesByProperties:', err.message)
  }

  // 2. Index IfcRelDefinesByType (cấu kiện -> type entity)
  try {
    const relTypeCode = typeof IFCRELDEFINESBYTYPE === 'number'
      ? IFCRELDEFINESBYTYPE
      : (api.GetTypeCodeFromName?.('IfcRelDefinesByType') ?? 781010003)
    const relTypes = api.GetLineIDsWithType(modelID, relTypeCode)
    const size = relTypes.size()
    for (let i = 0; i < size; i += 1) {
      const relId = relTypes.get(i)
      const rel = api.GetLine(modelID, relId)
      if (!rel) continue

      const relType = rel.RelatingType
      const typeId = typeof relType === 'object' && relType !== null ? relType.value : relType
      if (!typeId) continue

      const relObjs = rel.RelatedObjects
      const objs = Array.isArray(relObjs) ? relObjs : [relObjs]
      for (const obj of objs) {
        const objId = typeof obj === 'object' && obj !== null ? obj.value : obj
        if (objId) elementToTypeId.set(objId, typeId)
      }
    }
  } catch (err) {
    console.warn('[ifc-metadata] Warning indexing IfcRelDefinesByType:', err.message)
  }

  return { elementToPsetIds, elementToTypeId }
}

function parsePropertySet(api, modelID, psetId, psetCache) {
  if (psetCache.has(psetId)) return psetCache.get(psetId)
  try {
    const psetLine = api.GetLine(modelID, psetId)
    if (!psetLine) return null
    const psetName = psetLine.Name?.value ?? psetLine.Name ?? 'Pset'
    const props = {}

    // Case 1: IfcPropertySet (HasProperties)
    if (psetLine.HasProperties) {
      const arr = Array.isArray(psetLine.HasProperties) ? psetLine.HasProperties : [psetLine.HasProperties]
      for (const pRef of arr) {
        const pId = typeof pRef === 'object' && pRef !== null ? pRef.value : pRef
        if (!pId) continue
        const prop = api.GetLine(modelID, pId)
        const pName = prop?.Name?.value ?? prop?.Name
        if (!pName) continue
        const val = readPropValue(prop)
        if (val !== null && val !== undefined) props[pName] = val
      }
    }
    // Case 2: IfcElementQuantity (Quantities: Length, Area, Volume, etc.)
    else if (psetLine.Quantities) {
      const arr = Array.isArray(psetLine.Quantities) ? psetLine.Quantities : [psetLine.Quantities]
      for (const qRef of arr) {
        const qId = typeof qRef === 'object' && qRef !== null ? qRef.value : qRef
        if (!qId) continue
        const qLine = api.GetLine(modelID, qId)
        const qName = qLine?.Name?.value ?? qLine?.Name
        if (!qName) continue
        const val = readPropValue(qLine)
        if (val !== null && val !== undefined) props[qName] = val
      }
    }

    const res = { psetName, props }
    psetCache.set(psetId, res)
    return res
  } catch {
    return null
  }
}

export function collectPropertiesForElement(api, modelID, expressID, indices, psetCache) {
  const properties = {}
  const psets = {}
  const { elementToPsetIds, elementToTypeId } = indices

  // 1. Instance Psets & Quantities
  const psetIds = elementToPsetIds.get(expressID) || []
  for (const pid of psetIds) {
    const data = parsePropertySet(api, modelID, pid, psetCache)
    if (!data || !data.props || Object.keys(data.props).length === 0) continue
    const { psetName, props } = data
    if (!psets[psetName]) psets[psetName] = {}
    for (const [k, v] of Object.entries(props)) {
      properties[`${psetName}.${k}`] = v
      psets[psetName][k] = v
    }
  }

  // 2. Type Psets (kế thừa từ IfcTypeProduct nếu instance chưa có)
  const typeId = elementToTypeId.get(expressID)
  if (typeId) {
    try {
      const typeLine = api.GetLine(modelID, typeId)
      if (typeLine?.HasPropertySets) {
        const arr = Array.isArray(typeLine.HasPropertySets) ? typeLine.HasPropertySets : [typeLine.HasPropertySets]
        for (const pRef of arr) {
          const pid = typeof pRef === 'object' && pRef !== null ? pRef.value : pRef
          if (!pid) continue
          const data = parsePropertySet(api, modelID, pid, psetCache)
          if (!data || !data.props || Object.keys(data.props).length === 0) continue
          const { psetName, props } = data
          if (!psets[psetName]) psets[psetName] = {}
          for (const [k, v] of Object.entries(props)) {
            if (properties[`${psetName}.${k}`] === undefined) {
              properties[`${psetName}.${k}`] = v
            }
            if (psets[psetName][k] === undefined) {
              psets[psetName][k] = v
            }
          }
        }
      }
    } catch {
      /* ignore type pset error */
    }
  }

  return { properties, psets }
}

export function attachGeometricDimensions(properties, psets, typeName, bbox) {
  if (!bbox || !bbox.min || !bbox.max) return
  const [minX, minY, minZ] = bbox.min
  const [maxX, maxY, maxZ] = bbox.max
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return

  const dxM = Math.abs(maxX - minX)
  const dyM = Math.abs(maxY - minY)
  const dzM = Math.abs(maxZ - minZ)
  if (dxM === 0 && dyM === 0 && dzM === 0) return

  const toMm = (m) => Math.round(m * 1000)
  const dim = {}
  const u = (typeName || '').toUpperCase()

  if (u.includes('COLUMN')) {
    dim['Height'] = `${toMm(dyM)} mm`
    dim['Width'] = `${toMm(Math.min(dxM, dzM))} mm`
    dim['Depth'] = `${toMm(Math.max(dxM, dzM))} mm`
    dim['Length'] = `${toMm(dyM)} mm`
  } else if (u.includes('BEAM') || u.includes('MEMBER')) {
    const len = Math.max(dxM, dyM, dzM)
    dim['Length'] = `${toMm(len)} mm`
    dim['Height'] = `${toMm(dyM)} mm`
    dim['Width'] = `${toMm(Math.min(dxM, dzM))} mm`
  } else if (u.includes('WALL')) {
    dim['Height'] = `${toMm(dyM)} mm`
    dim['Length'] = `${toMm(Math.max(dxM, dzM))} mm`
    dim['Thickness'] = `${toMm(Math.min(dxM, dzM))} mm`
  } else if (u.includes('SLAB')) {
    dim['Thickness'] = `${toMm(dyM)} mm`
    dim['Length'] = `${toMm(Math.max(dxM, dzM))} mm`
    dim['Width'] = `${toMm(Math.min(dxM, dzM))} mm`
  } else {
    dim['Length'] = `${toMm(Math.max(dxM, dyM, dzM))} mm`
    dim['Width'] = `${toMm(Math.min(dxM, dzM))} mm`
    dim['Height'] = `${toMm(dyM)} mm`
  }

  // Nếu trong Pset đã có Span (từ Revit Common Pset), ưu tiên đồng bộ vào Dimensions
  if (properties['Pset_BeamCommon.Span']) {
    dim['Span'] = `${properties['Pset_BeamCommon.Span']} mm`
    dim['Length'] = `${properties['Pset_BeamCommon.Span']} mm`
  } else if (properties['Pset_MemberCommon.Span']) {
    dim['Span'] = `${properties['Pset_MemberCommon.Span']} mm`
    dim['Length'] = `${properties['Pset_MemberCommon.Span']} mm`
  }

  if (!psets['Dimensions']) psets['Dimensions'] = {}
  for (const [k, v] of Object.entries(dim)) {
    if (!psets['Dimensions'][k]) {
      psets['Dimensions'][k] = v
      properties[`Dimensions.${k}`] = v
    }
  }
}

/** Metadata v1 — giữ cho tương thích cũ / debug */
export function extractMetadata(api, modelID, meshNames, rtcCenter, unitScale) {
  const elements = []
  const typeCounts = {}
  let withGeometry = 0
  let withProperties = 0

  const indices = buildPropertyIndices(api, modelID)
  const psetCache = new Map()

  const allLines = api.GetAllLines(modelID)
  const size = allLines.size()
  for (let i = 0; i < size; i += 1) {
    const expressID = allLines.get(i)
    const line = api.GetLine(modelID, expressID)
    if (!line?.type || !api.IsIfcElement(line.type)) continue
    const typeName = api.GetNameFromTypeCode(line.type)
    const ifcType = typeName.toUpperCase()
    if (SPATIAL_CLASSES.has(ifcType)) continue

    typeCounts[typeName] = (typeCounts[typeName] || 0) + 1

    const globalId = line.GlobalId?.value ?? line.GlobalId
    if (!globalId) continue

    const meshName = meshNames[globalId] ?? null
    if (meshName) withGeometry += 1

    const { properties, psets } = collectPropertiesForElement(api, modelID, expressID, indices, psetCache)
    if (Object.keys(properties).length > 0) withProperties += 1

    elements.push({
      id: globalId,
      global_id: globalId,
      mesh_name: meshName,
      name: line.Name?.value ?? line.Name ?? 'Unnamed',
      type: typeName,
      properties,
      psets,
    })
  }

  return {
    elements,
    summary: {
      total_elements: elements.length,
      elements_with_geometry: withGeometry,
      elements_with_properties: withProperties,
      type_counts: typeCounts,
      length_unit_scale_to_meters: unitScale,
      rtc_center_offset: rtcCenter,
    },
  }
}

/**
 * @param {Set<string>|string[]} geometryGlobalIds — GlobalId gốc (không _dupN)
 * @param {string} [discipline]
 * @param {{ elementBBoxes?: Map<string, any>, expressIDByGlobalId?: Map<string, number> }} [options]
 */
export function extractPsetsMap(api, modelID, geometryGlobalIds, discipline = 'other', options = {}) {
  const want = new Set(geometryGlobalIds)
  const elements = {}
  const elementBBoxes = options.elementBBoxes || null
  const expressIDByGlobalId = options.expressIDByGlobalId || null

  const indices = buildPropertyIndices(api, modelID)
  const psetCache = new Map()

  // Fast path: direct expressID lookup avoids traversing all lines in large IFC files
  if (expressIDByGlobalId && expressIDByGlobalId.size > 0) {
    for (const [globalId, expressID] of expressIDByGlobalId.entries()) {
      if (!want.has(String(globalId))) continue
      const line = api.GetLine(modelID, expressID)
      if (!line) continue

      const typeName = api.GetNameFromTypeCode(line.type) || 'IfcProduct'
      const { properties, psets } = collectPropertiesForElement(api, modelID, expressID, indices, psetCache)

      if (elementBBoxes) {
        const bbox = elementBBoxes.get(String(globalId))
        if (bbox) {
          attachGeometricDimensions(properties, psets, typeName, bbox)
        }
      }

      elements[String(globalId)] = {
        name: line.Name?.value ?? line.Name ?? 'Unnamed',
        type: typeName,
        properties,
        psets,
      }
    }

    return {
      version: 1,
      discipline,
      elements,
    }
  }

  // Fallback path: iterate all lines
  const allLines = api.GetAllLines(modelID)
  const size = allLines.size()
  for (let i = 0; i < size; i += 1) {
    const expressID = allLines.get(i)
    const line = api.GetLine(modelID, expressID)
    if (!line?.type || !api.IsIfcElement(line.type)) continue
    const globalId = line.GlobalId?.value ?? line.GlobalId
    if (!globalId || !want.has(String(globalId))) continue

    const typeName = api.GetNameFromTypeCode(line.type)
    const { properties, psets } = collectPropertiesForElement(api, modelID, expressID, indices, psetCache)

    if (elementBBoxes) {
      const bbox = elementBBoxes.get(String(globalId))
      if (bbox) {
        attachGeometricDimensions(properties, psets, typeName, bbox)
      }
    }

    elements[String(globalId)] = {
      name: line.Name?.value ?? line.Name ?? 'Unnamed',
      type: typeName,
      properties,
      psets,
    }
  }

  return {
    version: 1,
    discipline,
    elements,
  }
}

export function buildMetadataV2({
  groups,
  rtcCenter,
  unitScale,
  discipline,
  displayName,
  psetsUrl,
  stats,
  elements,
}) {
  const materialGroups = groups.map((g) => ({
    key: g.key,
    discipline: g.discipline,
    ifcType: g.ifcType,
    colorHex: g.colorHex,
    color: g.color,
    opacity: g.opacity !== undefined ? g.opacity : 1.0,
    vertexCount: g.positions.length / 3,
    indexCount: g.indices.length,
    elementRanges: g.elementRanges,
  }))

  const res = {
    version: 2,
    discipline,
    displayName: displayName || discipline,
    unitScale,
    rtcCenter,
    materialGroups,
    elementsSummary: stats,
    psetsUrl,
  }

  if (elements) {
    res.elements = elements
  }

  return res
}

