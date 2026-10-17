import { SPATIAL_CLASSES } from './constants.js'

function readPropValue(prop) {
  try {
    const v = prop?.NominalValue?.value ?? prop?.NominalValue
    if (v === undefined || v === null) return null
    return String(v)
  } catch {
    return null
  }
}

function collectElementProperties(api, modelID, line) {
  const properties = {}
  const psets = {}
  const isDefinedBy = line.IsDefinedBy
  if (!Array.isArray(isDefinedBy)) {
    return { properties, psets }
  }
  for (const rel of isDefinedBy) {
    const relLine = typeof rel === 'number' ? api.GetLine(modelID, rel) : rel
    if (relLine?.type !== undefined && api.GetNameFromTypeCode(relLine.type) !== 'IfcRelDefinesByProperties') {
      continue
    }
    const pset = relLine?.RelatingPropertyDefinition
    const psetLine = typeof pset === 'number' ? api.GetLine(modelID, pset) : pset
    if (!psetLine?.HasProperties) continue
    const props = psetLine.HasProperties
    const arr = Array.isArray(props) ? props : [props]
    const psetName = psetLine.Name?.value ?? psetLine.Name ?? 'Pset'
    if (!psets[psetName]) psets[psetName] = {}
    for (const pRef of arr) {
      const prop = typeof pRef === 'number' ? api.GetLine(modelID, pRef) : pRef
      const propName = prop?.Name?.value ?? prop?.Name
      if (!propName) continue
      const val = readPropValue(prop)
      properties[`${psetName}.${propName}`] = val
      psets[psetName][propName] = val
    }
  }
  return { properties, psets }
}

/** Metadata v1 — giữ cho tương thích cũ / debug */
export function extractMetadata(api, modelID, meshNames, rtcCenter, unitScale) {
  const elements = []
  const typeCounts = {}
  let withGeometry = 0

  const allLines = api.GetAllLines(modelID)
  for (let i = 0; i < allLines.size(); i += 1) {
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

    const { properties } = collectElementProperties(api, modelID, line)

    elements.push({
      id: globalId,
      global_id: globalId,
      mesh_name: meshName,
      name: line.Name?.value ?? line.Name ?? 'Unnamed',
      type: typeName,
      properties,
    })
  }

  return {
    elements,
    summary: {
      total_elements: elements.length,
      elements_with_geometry: withGeometry,
      type_counts: typeCounts,
      length_unit_scale_to_meters: unitScale,
      rtc_center_offset: rtcCenter,
    },
  }
}

/**
 * @param {Set<string>|string[]} geometryGlobalIds — GlobalId gốc (không _dupN)
 */
export function extractPsetsMap(api, modelID, geometryGlobalIds, discipline = 'other') {
  const want = new Set(geometryGlobalIds)
  const elements = {}

  const allLines = api.GetAllLines(modelID)
  for (let i = 0; i < allLines.size(); i += 1) {
    const expressID = allLines.get(i)
    const line = api.GetLine(modelID, expressID)
    if (!line?.type || !api.IsIfcElement(line.type)) continue
    const globalId = line.GlobalId?.value ?? line.GlobalId
    if (!globalId || !want.has(String(globalId))) continue

    const typeName = api.GetNameFromTypeCode(line.type)
    const { properties, psets } = collectElementProperties(api, modelID, line)
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
}) {
  const materialGroups = groups.map((g) => ({
    key: g.key,
    discipline: g.discipline,
    ifcType: g.ifcType,
    colorHex: g.colorHex,
    color: g.color,
    vertexCount: g.positions.length / 3,
    indexCount: g.indices.length,
    elementRanges: g.elementRanges,
  }))

  return {
    version: 2,
    discipline,
    displayName: displayName || discipline,
    unitScale,
    rtcCenter,
    materialGroups,
    elementsSummary: stats,
    psetsUrl,
  }
}
