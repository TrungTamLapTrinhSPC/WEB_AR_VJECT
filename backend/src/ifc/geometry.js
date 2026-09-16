import path from 'path'
import { fileURLToPath } from 'url'
import { IfcAPI } from 'web-ifc'
import { colorFromPlacedGeometry, getProductColor } from './colors.js'
import { applyRtcAndYUp, sanitizeUsdName, transformPoint } from './utils.js'

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

function buildMeshFromFlat(api, modelID, flatMesh, expressID, idx) {
  const line = api.GetLine(modelID, expressID)
  const typeName = api.GetNameFromTypeCode(line?.type) || 'IfcProduct'
  const globalId = line?.GlobalId?.value ?? line?.GlobalId ?? String(expressID)
  const meshName = sanitizeUsdName(`${typeName}_${globalId}_${idx}`)

  const positions = []
  const indices = []
  let vertexBase = 0
  let color = null

  for (let g = 0; g < flatMesh.geometries.size(); g += 1) {
    const placed = flatMesh.geometries.get(g)
    const geom = api.GetGeometry(modelID, placed.geometryExpressID)
    const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())
    const inds = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())
    const m = placed.flatTransformation

    if (!color) {
      const fromGeom = colorFromPlacedGeometry(placed)
      color = getProductColor(typeName, line, fromGeom, api, modelID)
    }

    for (let i = 0; i < verts.length; i += 3) {
      const t = transformPoint(m, verts[i], verts[i + 1], verts[i + 2])
      positions.push(t.x, t.y, t.z)
    }
    for (let i = 0; i < inds.length; i += 1) {
      indices.push(vertexBase + inds[i])
    }
    vertexBase += verts.length / 3
    safeDelete(geom)
  }

  return {
    expressID,
    globalId,
    typeName,
    meshName,
    positions,
    indices,
    color,
  }
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
 * @param {Uint8Array} ifcData
 * @returns {Promise<{ meshes, meshNames, rtcCenter, unitScale, modelID, api }>}
 */
export async function loadIfcMeshes(ifcData) {
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
      const built = buildMeshFromFlat(api, modelID, flatMesh, expressID, meshIdx)
      if (built.indices.length >= 3) rawMeshes.push(built)
    } finally {
      safeDelete(flatMesh)
    }
  })

  const rtc = computeRtc(rawMeshes)
  const meshes = []
  const meshNames = {}

  for (const raw of rawMeshes) {
    const positions = []
    const p = raw.positions
    for (let i = 0; i < p.length; i += 3) {
      const yup = applyRtcAndYUp(p[i], p[i + 1], p[i + 2], rtc)
      positions.push(yup.x, yup.y, yup.z)
    }
    meshes.push({
      name: raw.meshName,
      globalId: raw.globalId,
      positions: new Float32Array(positions),
      indices: new Uint32Array(raw.indices),
      color: raw.color,
    })
    meshNames[raw.globalId] = raw.meshName
  }

  return { meshes, meshNames, rtcCenter: rtc, unitScale, modelID, api }
}

export function closeModel(api, modelID) {
  try {
    api.CloseModel(modelID)
  } catch {
    /* ignore */
  }
}
