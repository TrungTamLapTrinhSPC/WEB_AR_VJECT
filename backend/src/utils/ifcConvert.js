import fs from 'fs/promises'
import path from 'path'
import { loadIfcMeshes, closeModel } from '../ifc/geometry.js'
import { buildMetadataV2, extractPsetsMap } from '../ifc/metadata.js'
import { writeMeshesToGlb } from '../ifc/glbExport.js'
import { writeMeshesToUsdz } from '../ifc/usdzExport.js'
import { normalizeDisciplineCode } from './disciplines.js'

/**
 * IFC → GLB (merged) + USDZ (merged, 64-byte aligned) + metadata v2 + psets.json
 *
 * Supports signatures:
 * - convertIfcToOutputs(ifcPath, workDir, options)
 * - convertIfcToOutputs(ifcPath, workDir, baseName, options)
 */
export async function convertIfcToOutputs(ifcPath, workDir, arg3 = 'model', arg4 = {}) {
  let opts = {}
  let baseName = 'model'

  if (typeof arg3 === 'object' && arg3 !== null) {
    opts = arg3
    baseName = opts.baseName || 'model'
  } else {
    baseName = typeof arg3 === 'string' && arg3.trim() ? arg3 : 'model'
    opts = typeof arg4 === 'object' && arg4 !== null ? arg4 : {}
  }

  const discipline = normalizeDisciplineCode(opts.discipline || 'other')
  const displayName = opts.displayName || discipline

  await fs.mkdir(workDir, { recursive: true })
  const glbPath = path.join(workDir, `${baseName}.glb`)
  const metaPath = path.join(workDir, `${baseName}_metadata.json`)
  const usdzPath = path.join(workDir, `${baseName}.usdz`)
  const psetsFileName = `${discipline}_psets.json`
  const psetsPath = path.join(workDir, psetsFileName)

  const overrideDisciplineColors = opts.overrideDisciplineColors ?? opts.override_discipline_colors ?? false
  const boostColorVibrancy = opts.boostColorVibrancy ?? opts.boost_color_vibrancy ?? opts.vibrantColors ?? true
  const ifcData = new Uint8Array(await fs.readFile(ifcPath))
  const res = await loadIfcMeshes(ifcData, { discipline, overrideDisciplineColors, boostColorVibrancy })
  const groups = res?.groups || []
  const rtcCenter = res?.rtcCenter || [0, 0, 0]
  const unitScale = res?.unitScale || 1.0
  const modelID = res?.modelID
  const api = res?.api
  const stats = res?.stats || { total_elements: 0, total_triangles: 0 }

  if (!groups || !groups.length) {
    if (api && modelID !== undefined) closeModel(api, modelID)
    throw new Error('No geometry found in IFC file')
  }

  // 1. Extract Psets map
  const geometryGlobalIds = new Set()
  const elementBBoxes = new Map()
  const expressIDByGlobalId = new Map()
  for (const group of groups) {
    for (const range of group.elementRanges) {
      const rawId = range.ifcId.replace(/_dup\d+$/, '')
      geometryGlobalIds.add(rawId)
      if (range.expressID !== undefined && !expressIDByGlobalId.has(rawId)) {
        expressIDByGlobalId.set(rawId, range.expressID)
      }
      if (range.bbox && !elementBBoxes.has(rawId)) {
        elementBBoxes.set(rawId, range.bbox)
      }
    }
  }

  let psetsData = { version: 1, discipline, elements: {} }
  try {
    psetsData = extractPsetsMap(api, modelID, geometryGlobalIds, discipline, {
      elementBBoxes,
      expressIDByGlobalId,
    })
  } catch (psetErr) {
    console.warn('[ifc-js] PSet extraction warning:', psetErr.message)
  }

  // Attach properties & psets directly to each element in elementRanges
  for (const group of groups) {
    for (const range of group.elementRanges) {
      const rawId = range.ifcId.replace(/_dup\d+$/, '')
      const elData = psetsData.elements?.[rawId] || psetsData.elements?.[range.ifcId]
      if (elData) {
        range.properties = elData.properties || {}
        range.psets = elData.psets || {}
      } else {
        range.properties = {}
        range.psets = {}
      }
    }
  }

  // Backwards compatibility for clients/endpoints expecting metadata.elements (METADATA_CONVERTER_SPEC & bimController)
  const elements = Object.entries(psetsData.elements || {}).map(([globalId, el]) => ({
    id: globalId,
    global_id: globalId,
    name: el.name,
    type: el.type,
    properties: el.properties || {},
    psets: el.psets || {},
  }))

  const elementsWithProps = elements.filter(
    (e) => e.properties && Object.keys(e.properties).length > 0,
  ).length
  stats.elements_with_properties = elementsWithProps

  // 2. Build Metadata V2
  const metadataV2 = buildMetadataV2({
    groups,
    rtcCenter,
    unitScale,
    discipline,
    displayName,
    psetsUrl: `./${psetsFileName}`,
    stats,
    elements,
  })

  console.log(
    `[ifc-js] Phase 1 Merged Mesh: ${groups.length} material groups, `
    + `${stats.total_elements} elements, ${stats.total_triangles.toLocaleString()} triangles `
    + `(RTC: ${rtcCenter.map((v) => v.toFixed(4)).join(', ')})`,
  )

  try {
    // 3. Export GLB (Merged per material group)
    await writeMeshesToGlb(groups, glbPath)

    // 4. Export USDZ (Merged per material group, 64-byte aligned)
    try {
      await writeMeshesToUsdz(groups, usdzPath, { discipline })
    } catch (usdzErr) {
      console.warn('[ifc-js] USDZ export failed (GLB still produced):', usdzErr.message)
    }

    // 5. Write metadata V2 and PSet JSON
    await fs.writeFile(metaPath, JSON.stringify(metadataV2, null, 2), 'utf8')
    await fs.writeFile(psetsPath, JSON.stringify(psetsData, null, 2), 'utf8')
  } finally {
    closeModel(api, modelID)
  }

  const usdzStat = await fs.stat(usdzPath).catch(() => null)

  return {
    glbPath,
    usdzPath: usdzStat ? usdzPath : null,
    metadataPath: metaPath,
    psetsPath,
  }
}

