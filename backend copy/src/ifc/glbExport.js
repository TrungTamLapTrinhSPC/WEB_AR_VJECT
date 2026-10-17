import { Document, NodeIO } from '@gltf-transform/core'

/**
 * @param {Array<{ key, name, positions, indices, color }>} groups
 */
export async function writeMeshesToGlb(groups, outPath) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()

  for (const m of groups) {
    const position = doc.createAccessor()
      .setType('VEC3')
      .setArray(m.positions)
      .setBuffer(buffer)

    const indices = doc.createAccessor()
      .setType('SCALAR')
      .setArray(m.indices)
      .setBuffer(buffer)

    const material = doc.createMaterial()
      .setBaseColorFactor([m.color[0], m.color[1], m.color[2], 1.0])
      .setMetallicFactor(0.1)
      .setRoughnessFactor(0.4)

    const primitive = doc.createPrimitive()
      .setAttribute('POSITION', position)
      .setIndices(indices)
      .setMaterial(material)

    const mesh = doc.createMesh().addPrimitive(primitive)
    const nodeName = m.key || m.name
    const node = doc.createNode(nodeName).setMesh(mesh)
    scene.addChild(node)
  }

  const io = new NodeIO()
  await io.write(outPath, doc)
}
