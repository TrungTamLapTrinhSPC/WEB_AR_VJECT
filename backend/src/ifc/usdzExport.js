import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'
import { ZipArchive } from 'archiver'

function usdaHeader() {
  return `#usda 1.0
(
    defaultPrim = "BIMModel"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "BIMModel" (
    kind = "component"
)
{
`
}

function meshBlock(name, positions, indices, color) {
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
  return `
    def Mesh "${name}"
    {
        uniform token subdivisionScheme = "none"
        point3f[] points = [${points.join(', ')}]
        int[] faceVertexCounts = [${faceVertexCounts.join(', ')}]
        int[] faceVertexIndices = [${faceVertexIndices.join(', ')}]
        color3f[] displayColor = [(${r}, ${g}, ${b})]
    }
`
}

export async function writeMeshesToUsdz(meshes, usdzPath) {
  const usdaName = path.basename(usdzPath).replace(/\.usdz$/i, '.usda')
  let body = usdaHeader()
  const used = new Set()
  for (const m of meshes) {
    let name = m.name
    let n = 1
    while (used.has(name)) {
      name = `${m.name}_${n}`
      n += 1
    }
    used.add(name)
    body += meshBlock(name, m.positions, m.indices, m.color)
  }
  body += '}\n'

  const usdaPath = usdzPath.replace(/\.usdz$/i, '.usda')
  await fs.writeFile(usdaPath, body, 'utf8')

  await new Promise((resolve, reject) => {
    const output = createWriteStream(usdzPath)
    const archive = new ZipArchive({ store: true })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.file(usdaPath, { name: usdaName })
    archive.finalize()
  })

  await fs.unlink(usdaPath).catch(() => {})
}
