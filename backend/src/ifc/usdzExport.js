import fs from 'fs/promises'
import path from 'path'
import { sanitizeUsdName } from './utils.js'
import { create64ByteAlignedUsdz } from './usdzAlignedZip.js'

function usdaHeader(discipline) {
  const root = sanitizeUsdName(`discipline_${discipline}`)
  return `#usda 1.0
(
    defaultPrim = "${root}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${root}" (
    kind = "component"
)
{
`
}

function materialBlock(root, matName, color, opacity = 1.0) {
  const [r, g, b] = color
  const isTrans = opacity < 0.99
  const roughness = isTrans ? 0.1 : 0.35
  const opacityField = isTrans ? `\n                float inputs:opacity = ${opacity}` : ''
  return `        def Material "${matName}"
        {
            token outputs:surface.connect = </${root}/Looks/${matName}/PBRShader.outputs:surface>
            def Shader "PBRShader"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = (${r}, ${g}, ${b})${opacityField}
                float inputs:roughness = ${roughness}
                float inputs:metallic = 0.0
                token outputs:surface
            }
        }
`
}

function meshBlock(meshName, matPath, positions, indices, color, opacity = 1.0) {
  const points = []
  const len = positions.length
  for (let i = 0; i < len; i += 3) {
    points.push(`(${positions[i]}, ${positions[i + 1]}, ${positions[i + 2]})`)
  }
  const faceVertexCounts = []
  const faceVertexIndices = []
  const ilen = indices.length
  for (let i = 0; i < ilen; i += 3) {
    faceVertexCounts.push(3)
    faceVertexIndices.push(indices[i], indices[i + 1], indices[i + 2])
  }
  const [r, g, b] = color
  const doubleSidedAttr = opacity < 0.99 ? '\n        uniform bool doubleSided = 1' : ''
  return `
    def Mesh "${meshName}" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        rel material:binding = <${matPath}>
        uniform token subdivisionScheme = "none"${doubleSidedAttr}
        point3f[] points = [${points.join(', ')}]
        int[] faceVertexCounts = [${faceVertexCounts.join(', ')}]
        int[] faceVertexIndices = [${faceVertexIndices.join(', ')}]
        color3f[] displayColor = [(${r}, ${g}, ${b})] (interpolation = "constant")
    }
`
}

/**
 * @param {Array<{ key, name, positions, indices, color, opacity? }>} groups
 */
export async function writeMeshesToUsdz(groups, usdzPath, options = {}) {
  const discipline = options.discipline ?? 'other'
  const root = sanitizeUsdName(`discipline_${discipline}`)
  const usdaName = path.basename(usdzPath).replace(/\.usdz$/i, '.usda')
  let body = usdaHeader(discipline)

  // 1. Create Looks scope with UsdPreviewSurface materials
  body += `    def Scope "Looks"\n    {\n`
  const matMap = new Map()
  for (const m of groups) {
    const matName = sanitizeUsdName(`mat_${m.key || m.name}`)
    if (!matMap.has(matName)) {
      matMap.set(matName, `/${root}/Looks/${matName}`)
      body += materialBlock(root, matName, m.color, m.opacity ?? 1.0)
    }
  }
  body += `    }\n`

  // 2. Create Meshes with material bindings
  const used = new Set()
  for (const m of groups) {
    let name = m.key || m.name
    let n = 1
    while (used.has(name)) {
      name = `${m.key || m.name}_${n}`
      n += 1
    }
    used.add(name)
    const matName = sanitizeUsdName(`mat_${m.key || m.name}`)
    const matPath = matMap.get(matName)
    body += meshBlock(name, matPath, m.positions, m.indices, m.color, m.opacity ?? 1.0)
  }
  body += '}\n'

  const zipBuf = create64ByteAlignedUsdz(usdaName, Buffer.from(body, 'utf8'))
  await fs.writeFile(usdzPath, zipBuf)
}
