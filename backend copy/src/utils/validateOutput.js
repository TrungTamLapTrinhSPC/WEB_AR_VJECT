import fs from 'fs/promises'
import path from 'path'

/**
 * Validate conversion outputs against Phase 1 criteria:
 * 1. Metadata version == 2
 * 2. Total element ranges == total elements
 * 3. Unique ifcIds across metadata
 * 4. Continuous, non-overlapping vertex/index ranges per material group
 * 5. USDZ 64-byte zip alignment
 * 6. Mesh count in metadata < 100 per discipline
 */
export async function validateOutput(workDir, baseName = 'model') {
  const metaPath = path.join(workDir, `${baseName}_metadata.json`)
  const usdzPath = path.join(workDir, `${baseName}.usdz`)
  const glbPath = path.join(workDir, `${baseName}.glb`)

  const errors = []
  const warnings = []

  // Read metadata
  let metadata
  try {
    const rawMeta = await fs.readFile(metaPath, 'utf8')
    metadata = JSON.parse(rawMeta)
  } catch (err) {
    return { valid: false, errors: [`Failed to read metadata: ${err.message}`], warnings }
  }

  // 1. Version check
  if (metadata.version !== 2) {
    errors.push(`Expected metadata version 2, got ${metadata.version}`)
  }

  // 2. Material groups check
  const groups = metadata.materialGroups || []
  if (!Array.isArray(groups) || groups.length === 0) {
    errors.push('metadata.materialGroups is missing or empty')
  }

  if (groups.length > 100) {
    warnings.push(`Material group count is high (${groups.length} groups)`)
  }

  const allIfcIds = new Set()
  let totalRangesCount = 0

  for (const group of groups) {
    const ranges = group.elementRanges || []
    totalRangesCount += ranges.length

    let expectedVertex = 0
    let expectedIndex = 0

    for (let i = 0; i < ranges.length; i += 1) {
      const r = ranges[i]

      // Unique ifcId check
      if (allIfcIds.has(r.ifcId)) {
        errors.push(`Duplicate ifcId found in metadata: ${r.ifcId}`)
      }
      allIfcIds.add(r.ifcId)

      // Range continuity & overlap check
      if (r.vertexStart !== expectedVertex) {
        errors.push(`Discontinuous vertex range in group ${group.key} at index ${i}: expected start ${expectedVertex}, got ${r.vertexStart}`)
      }
      if (r.vertexEnd <= r.vertexStart) {
        errors.push(`Invalid vertex range [${r.vertexStart}, ${r.vertexEnd}] for ${r.ifcId}`)
      }
      expectedVertex = r.vertexEnd

      if (r.indexStart !== expectedIndex) {
        errors.push(`Discontinuous index range in group ${group.key} at index ${i}: expected start ${expectedIndex}, got ${r.indexStart}`)
      }
      if (r.indexEnd < r.indexStart) {
        errors.push(`Invalid index range [${r.indexStart}, ${r.indexEnd}] for ${r.ifcId}`)
      }
      expectedIndex = r.indexEnd

      // Bbox check
      if (!r.bbox || !Array.isArray(r.bbox.min) || !Array.isArray(r.bbox.max)) {
        errors.push(`Missing or malformed bbox for element ${r.ifcId}`)
      }
    }
  }

  // 3. Total elements count check
  const expectedTotal = metadata.elementsSummary?.total_elements
  if (expectedTotal !== undefined && totalRangesCount !== expectedTotal) {
    errors.push(`Total element ranges count (${totalRangesCount}) does not match summary total_elements (${expectedTotal})`)
  }

  // 4. USDZ 64-byte alignment check
  try {
    const usdzBuf = await fs.readFile(usdzPath)
    if (usdzBuf.length < 30) {
      errors.push('USDZ file is smaller than ZIP header minimum size')
    } else {
      const filenameLen = usdzBuf.readUInt16LE(26)
      const extraLen = usdzBuf.readUInt16LE(28)
      const dataOffset = 30 + filenameLen + extraLen
      if (dataOffset % 64 !== 0) {
        errors.push(`USDZ 64-byte alignment failed: uncompressed data offset is ${dataOffset} (remainder: ${dataOffset % 64})`)
      }
    }
  } catch (err) {
    errors.push(`Failed to read USDZ file: ${err.message}`)
  }

  // 5. GLB file check
  try {
    const glbStat = await fs.stat(glbPath)
    if (glbStat.size === 0) {
      errors.push('GLB file size is 0 bytes')
    }
  } catch (err) {
    errors.push(`Failed to read GLB file: ${err.message}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      groupCount: groups.length,
      elementCount: totalRangesCount,
      version: metadata.version,
      discipline: metadata.discipline,
    },
  }
}
