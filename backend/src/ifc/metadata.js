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

    const elem = {
      id: globalId,
      global_id: globalId,
      mesh_name: meshName,
      name: line.Name?.value ?? line.Name ?? 'Unnamed',
      type: typeName,
      properties: {},
    }

    const isDefinedBy = line.IsDefinedBy
    if (Array.isArray(isDefinedBy)) {
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
        for (const pRef of arr) {
          const prop = typeof pRef === 'number' ? api.GetLine(modelID, pRef) : pRef
          const psetName = psetLine.Name?.value ?? psetLine.Name ?? 'Pset'
          const propName = prop?.Name?.value ?? prop?.Name
          if (!propName) continue
          elem.properties[`${psetName}.${propName}`] = readPropValue(prop)
        }
      }
    }

    elements.push(elem)
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
