import fs from 'fs/promises'
import path from 'path'
import { loadIfcMeshes, closeModel } from '../ifc/geometry.js'
import { extractMetadata } from '../ifc/metadata.js'
import { writeMeshesToGlb } from '../ifc/glbExport.js'
import { writeMeshesToUsdz } from '../ifc/usdzExport.js'

/**
 * IFC → GLB + USDZ + metadata.json (Node.js / web-ifc).
 * Thuật toán port từ backend/converter_core.py — không gọi Python lúc upload.
 */
export async function convertIfcToOutputs(ifcPath, workDir, baseName = 'model') {
  await fs.mkdir(workDir, { recursive: true })
  const glbPath = path.join(workDir, `${baseName}.glb`)
  const metaPath = path.join(workDir, `${baseName}_metadata.json`)
  const usdzPath = path.join(workDir, `${baseName}.usdz`)

  const ifcData = new Uint8Array(await fs.readFile(ifcPath))
  const { meshes, meshNames, rtcCenter, unitScale, modelID, api } = await loadIfcMeshes(ifcData)

  if (!meshes.length) {
    closeModel(api, modelID)
    throw new Error('No geometry found in IFC file')
  }

  let metadata
  try {
    metadata = extractMetadata(api, modelID, meshNames, rtcCenter, unitScale)
  } catch (metaErr) {
    console.warn('[ifc-js] metadata extraction failed:', metaErr.message)
    metadata = {
      elements: [],
      summary: {
        total_elements: 0,
        elements_with_geometry: meshes.length,
        type_counts: {},
        length_unit_scale_to_meters: unitScale,
        rtc_center_offset: rtcCenter,
      },
    }
  }

  const triangleCount = meshes.reduce((n, m) => n + m.indices.length / 3, 0)
  console.log(
    `[ifc-js] ${meshes.length} meshes, ${Math.round(triangleCount).toLocaleString()} triangles `
    + `(RTC ${rtcCenter.map((v) => v.toFixed(4)).join(', ')})`,
  )
  if (triangleCount > 2_000_000) {
    console.warn('[ifc-js] Over 2M triangles — mobile AR may struggle to render this model.')
  }

  try {
    await writeMeshesToGlb(meshes, glbPath)
    try {
      await writeMeshesToUsdz(meshes, usdzPath)
    } catch (usdzErr) {
      console.warn('[ifc-js] USDZ export failed (GLB still produced):', usdzErr.message)
    }
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8')
  } finally {
    closeModel(api, modelID)
  }

  const usdzStat = await fs.stat(usdzPath).catch(() => null)

  return {
    glbPath,
    usdzPath: usdzStat ? usdzPath : null,
    metadataPath: metaPath,
  }
}
