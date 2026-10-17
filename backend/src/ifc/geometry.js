import path from 'path'
import { fileURLToPath } from 'url'
import { IfcAPI } from 'web-ifc'
import { colorFromPlacedGeometry, getProductColor } from './colors.js'
import { DEFAULT_COLOR, SPATIAL_CLASSES } from './constants.js'
import { applyRtcAndYUp, sanitizeUsdName, transformPoint } from './utils.js'
import { normalizeDisciplineCode } from '../utils/disciplines.js'

const wasmDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/web-ifc')

let apiSingleton

function safeDelete(obj) {
  if (obj && typeof obj.delete === 'function') {
    try {
      obj.delete()
    } catch {
      /* web-ifc version may not expose delete on all handles */
    }
  }
}

async function getApi() {
  if (apiSingleton) return apiSingleton
  const ifcApi = new IfcAPI()
  await ifcApi.Init((p) => {
    if (p.endsWith('.wasm')) return path.join(wasmDir, 'web-ifc-node.wasm')
    return p
  }, true)
  apiSingleton = ifcApi
  return ifcApi
}

function readUnitScaleToMeters(api, modelID) {
  try {
    const matrix = api.GetCoordinationMatrix(modelID)
    if (matrix && matrix.length >= 16 && matrix[0] > 0) {
      return matrix[0]
    }
  } catch {
    /* default */
  }
  return 1.0
}

export function rgbToHex(color) {
  const c = color?.length >= 3 ? color : DEFAULT_COLOR
  const clamp = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)
  const r = clamp(c[0]).toString(16).padStart(2, '0')
  const g = clamp(c[1]).toString(16).padStart(2, '0')
  const b = clamp(c[2]).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`.toUpperCase()
}

function computeBBox(positions, floatStart, floatEnd) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = floatStart; i < floatEnd; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }
  if (minX === Infinity) {
    return { min: [0, 0, 0], max: [0, 0, 0] }
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

function buildMeshFromFlat(api, modelID, flatMesh, expressID, idx, options = {}) {
  const line = api.GetLine(modelID, expressID)
  const typeName = api.GetNameFromTypeCode(line?.type) || 'IfcProduct'
  const globalId = line?.GlobalId?.value ?? line?.GlobalId ?? String(expressID)
  const displayName = line?.Name?.value ?? line?.Name ?? 'Unnamed'

  const geomSize = flatMesh.geometries.size()
  if (geomSize === 0) return []

  // Group sub-geometries by their resolved material / color & opacity
  const subMeshesMap = new Map()

  for (let g = 0; g < geomSize; g += 1) {
    const placed = flatMesh.geometries.get(g)
    const fromGeom = colorFromPlacedGeometry(placed)
    const resolvedColor = getProductColor(typeName, line, fromGeom, api, modelID, options)

    const r = resolvedColor[0]
    const gCol = resolvedColor[1]
    const b = resolvedColor[2]
    const opacity = resolvedColor.length > 3 ? resolvedColor[3] : 1.0

    const colorKey = `${r.toFixed(3)}_${gCol.toFixed(3)}_${b.toFixed(3)}_${opacity.toFixed(3)}`

    let sub = subMeshesMap.get(colorKey)
    if (!sub) {
      sub = {
        color: [r, gCol, b],
        opacity,
        positions: [],
        indices: [],
        vertexBase: 0,
      }
      subMeshesMap.set(colorKey, sub)
    }

    const geom = api.GetGeometry(modelID, placed.geometryExpressID)
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())
    const inds = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())
    const m = placed.flatTransformation

    for (let i = 0; i < verts.length; i += 6) {
      const t = transformPoint(m, verts[i], verts[i + 1], verts[i + 2])
      sub.positions.push(t.x, t.y, t.z)
    }
    for (let i = 0; i < inds.length; i += 1) {
      sub.indices.push(sub.vertexBase + inds[i])
    }
    sub.vertexBase += verts.length / 6
    safeDelete(geom)
  }

  const result = []
  let partIdx = 0
  for (const sub of subMeshesMap.values()) {
    if (sub.indices.length < 3) continue
    const suffix = subMeshesMap.size > 1 ? `_p${partIdx}` : ''
    result.push({
      expressID,
      globalId,
      typeName,
      displayName,
      meshName: sanitizeUsdName(`${typeName}_${globalId}_${idx}${suffix}`),
      positions: sub.positions,
      indices: sub.indices,
      color: sub.color,
      opacity: sub.opacity,
    })
    partIdx += 1
  }

  return result
}

function computeRtc(rawMeshes) {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const m of rawMeshes) {
    const p = m.positions
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i])
      minY = Math.min(minY, p[i + 1])
      minZ = Math.min(minZ, p[i + 2])
      maxX = Math.max(maxX, p[i])
      maxY = Math.max(maxY, p[i + 1])
      maxZ = Math.max(maxZ, p[i + 2])
    }
  }

  if (minX === Infinity) return [0, 0, 0]
  return [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ]
}

/**
 * Gom các mesh đã RTC+Y-up theo material group.
 * @param {Array<{ globalId, typeName, displayName, positions: Float32Array, indices: Uint32Array, color: number[], opacity?: number }>} elements
 */
export function mergeMaterialGroups(elements, discipline) {
  const disc = normalizeDisciplineCode(discipline)
  const groupsMap = new Map()
  const seenIds = new Map()

  for (const el of elements) {
    const colorHex = rgbToHex(el.color)
    const hexNoHash = colorHex.slice(1)
    const opacity = el.opacity !== undefined ? el.opacity : (el.color?.length > 3 ? el.color[3] : 1.0)
    const isTrans = opacity < 0.99
    const opTag = isTrans ? `_T${Math.round(opacity * 100)}` : ''
    const logicKey = `${disc}_${el.typeName}_${colorHex}${opTag}`
    let primKey = sanitizeUsdName(`${disc}_${el.typeName}_${hexNoHash}${opTag}`)

    if (!groupsMap.has(logicKey)) {
      groupsMap.set(logicKey, {
        key: primKey,
        name: primKey,
        discipline: disc,
        ifcType: el.typeName,
        colorHex,
        color: [el.color[0], el.color[1], el.color[2]],
        opacity,
        positions: [],
        indices: [],
        elementRanges: [],
      })
    }
    const group = groupsMap.get(logicKey)

    let ifcId = String(el.globalId)
    const prev = seenIds.get(ifcId) ?? 0
    if (prev > 0) {
      ifcId = `${ifcId}_dup${prev}`
      console.warn(`[ifc-js] duplicate GlobalId, using ${ifcId}`)
    }
    seenIds.set(String(el.globalId), prev + 1)

    const vertexStart = group.positions.length / 3
    const floatStart = group.positions.length
    for (let i = 0; i < el.positions.length; i += 1) {
      group.positions.push(el.positions[i])
    }
    const vertexEnd = group.positions.length / 3
    const indexStart = group.indices.length
    for (let i = 0; i < el.indices.length; i += 1) {
      group.indices.push(el.indices[i] + vertexStart)
    }
    const indexEnd = group.indices.length

    group.elementRanges.push({
      expressID: el.expressID,
      ifcId,
      ifcType: el.typeName,
      name: el.displayName,
      vertexStart,
      vertexEnd,
      indexStart,
      indexEnd,
      bbox: computeBBox(group.positions, floatStart, group.positions.length),
    })
  }

  const groups = []
  for (const g of groupsMap.values()) {
    groups.push({
      ...g,
      positions: new Float32Array(g.positions),
      indices: new Uint32Array(g.indices),
    })
  }

  return groups
}

function computeStats(groups, elementCount) {
  let totalVertices = 0
  let totalIndices = 0
  const typeCounts = {}
  for (const g of groups) {
    totalVertices += g.positions.length / 3
    totalIndices += g.indices.length
    for (const r of g.elementRanges) {
      typeCounts[r.ifcType] = (typeCounts[r.ifcType] || 0) + 1
    }
  }
  return {
    total_elements: elementCount,
    elements_with_geometry: elementCount,
    total_groups: groups.length,
    total_vertices: totalVertices,
    total_triangles: Math.floor(totalIndices / 3),
    type_counts: typeCounts,
  }
}

/**
 * @param {Uint8Array} ifcData
 * @param {{ discipline?: string }} [options]
 * @returns {Promise<{ groups, meshes, meshNames, rtcCenter, unitScale, modelID, api, stats }>}
 */
export async function loadIfcMeshes(ifcData, options = {}) {
  const discipline = options.discipline ?? 'other'
  const api = await getApi()
  const modelID = api.OpenModel(ifcData, { COORDINATE_TO_ORIGIN: false })
  if (modelID < 0) throw new Error('Failed to open IFC model')

  const unitScale = readUnitScaleToMeters(api, modelID)
  const rawMeshes = []
  let meshIdx = 0

  api.StreamAllMeshes(modelID, (flatMesh) => {
    meshIdx += 1
    const expressID = flatMesh.expressID
    try {
      const built = buildMeshFromFlat(api, modelID, flatMesh, expressID, meshIdx, options)
      const list = Array.isArray(built) ? built : (built ? [built] : [])
      for (const item of list) {
        const ifcType = item.typeName.toUpperCase()
        if (SPATIAL_CLASSES.has(ifcType)) continue
        if (item.indices.length < 3) continue
        rawMeshes.push(item)
      }
    } finally {
      safeDelete(flatMesh)
    }
  })

  const rtc = computeRtc(rawMeshes)
  const shifted = []
  const meshNames = {}

  for (const raw of rawMeshes) {
    const positions = []
    const p = raw.positions
    for (let i = 0; i < p.length; i += 3) {
      const yup = applyRtcAndYUp(p[i], p[i + 1], p[i + 2], rtc)
      positions.push(yup.x, yup.y, yup.z)
    }
    shifted.push({
      expressID: raw.expressID,
      globalId: raw.globalId,
      typeName: raw.typeName,
      displayName: raw.displayName,
      positions: new Float32Array(positions),
      indices: new Uint32Array(raw.indices),
      color: raw.color,
      opacity: raw.opacity !== undefined ? raw.opacity : 1.0,
    })
    meshNames[raw.globalId] = raw.meshName
  }

  const groups = mergeMaterialGroups(shifted, discipline)
  const stats = computeStats(groups, shifted.length)

  // Per-element meshes (v1 API) — giữ để ifcConvert.js cũ không lỗi `meshes.length`
  const meshes = shifted.map((el) => ({
    name: meshNames[el.globalId],
    globalId: el.globalId,
    positions: el.positions,
    indices: el.indices,
    color: el.color,
  }))

  const rtcCenterIfc = [rtc[0], -rtc[2], rtc[1]]

  return { groups, meshes, meshNames, rtcCenter: rtcCenterIfc, unitScale, modelID, api, stats }
}

export function closeModel(api, modelID) {
  try {
    api.CloseModel(modelID)
  } catch {
    /* ignore */
  }
}
