/** Uncompressed ZIP with 64-byte aligned payload (USDZ / Quick Look). */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * @param {string} entryName — path inside archive (e.g. model.usda)
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer}
 */
export function create64ByteAlignedUsdz(entryName, data) {
  const nameBuf = Buffer.from(entryName, 'utf8')
  const fileData = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const crc = crc32(fileData)
  const size = fileData.length

  const localHeaderSize = 30 + nameBuf.length
  const pad = (64 - (localHeaderSize % 64)) % 64
  const localRecordSize = localHeaderSize + pad + size

  const parts = []

  const lh = Buffer.alloc(30)
  lh.writeUInt32LE(0x04034b50, 0)
  lh.writeUInt16LE(20, 4)
  lh.writeUInt16LE(0, 6)
  lh.writeUInt16LE(0, 8)
  lh.writeUInt16LE(0, 10)
  lh.writeUInt16LE(0, 12)
  lh.writeUInt32LE(crc, 14)
  lh.writeUInt32LE(size, 18)
  lh.writeUInt32LE(size, 22)
  lh.writeUInt16LE(nameBuf.length, 26)
  lh.writeUInt16LE(pad, 28)
  parts.push(lh, nameBuf)
  if (pad > 0) parts.push(Buffer.alloc(pad))
  parts.push(fileData)

  const centralOffset = localRecordSize
  const cd = Buffer.alloc(46 + nameBuf.length)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(20, 4)
  cd.writeUInt16LE(20, 6)
  cd.writeUInt16LE(0, 8)
  cd.writeUInt16LE(0, 10)
  cd.writeUInt16LE(0, 12)
  cd.writeUInt16LE(0, 14)
  cd.writeUInt32LE(crc, 16)
  cd.writeUInt32LE(size, 20)
  cd.writeUInt32LE(size, 24)
  cd.writeUInt16LE(nameBuf.length, 28)
  cd.writeUInt16LE(pad, 30)
  cd.writeUInt16LE(0, 32)
  cd.writeUInt16LE(0, 34)
  cd.writeUInt16LE(0, 36)
  cd.writeUInt32LE(0, 38)
  cd.writeUInt32LE(0, 42) // relative offset of local header
  nameBuf.copy(cd, 46)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(46 + nameBuf.length, 12)
  end.writeUInt32LE(centralOffset, 16)
  end.writeUInt16LE(0, 20)

  parts.push(cd, end)
  return Buffer.concat(parts)
}
