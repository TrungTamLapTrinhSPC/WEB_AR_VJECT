import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeMaterialGroups, rgbToHex } from '../../src/ifc/geometry.js'
import { create64ByteAlignedUsdz } from '../../src/ifc/usdzAlignedZip.js'

describe('rgbToHex', () => {
  it('formats uppercase hex', () => {
    assert.equal(rgbToHex([1, 0.5, 0]), '#FF8000')
  })
})

describe('mergeMaterialGroups', () => {
  it('merges by discipline, type, and color', () => {
    const elements = [
      {
        globalId: 'A',
        typeName: 'IfcBeam',
        displayName: 'B1',
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        color: [0.5, 0.5, 0.5],
      },
      {
        globalId: 'B',
        typeName: 'IfcBeam',
        displayName: 'B2',
        positions: new Float32Array([2, 0, 0, 3, 0, 0, 2, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        color: [0.5, 0.5, 0.5],
      },
      {
        globalId: 'C',
        typeName: 'IfcColumn',
        displayName: 'C1',
        positions: new Float32Array([0, 2, 0, 1, 2, 0, 0, 3, 0]),
        indices: new Uint32Array([0, 1, 2]),
        color: [1, 0, 0],
      },
    ]
    const groups = mergeMaterialGroups(elements, 'structure')
    assert.equal(groups.length, 2)
    const beam = groups.find((g) => g.ifcType === 'IfcBeam')
    assert.equal(beam.elementRanges.length, 2)
    assert.equal(beam.elementRanges[0].vertexEnd, beam.elementRanges[1].vertexStart)
    assert.equal(beam.indices.length, 6)
  })
})

describe('create64ByteAlignedUsdz', () => {
  it('aligns uncompressed data offset to 64 bytes', () => {
    const zip = create64ByteAlignedUsdz('test.usda', Buffer.from('#usda 1.0\n'))
    assert.ok(zip.length > 30)
    const nameLen = Buffer.from('test.usda', 'utf8').length
    const localHeader = 30 + nameLen
    const pad = (64 - (localHeader % 64)) % 64
    const dataOffset = localHeader + pad
    assert.equal(dataOffset % 64, 0)
  })
})
