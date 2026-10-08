import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '../middleware/errorHandler.js'

export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024
export const MAX_IFC_BYTES = 500 * 1024 * 1024
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUploadId(uploadId) {
  if (!UPLOAD_ID_RE.test(String(uploadId || ''))) {
    throw new AppError('VALIDATION_ERROR', 'Invalid upload session id')
  }
}

function sessionDir(root, uploadId) {
  assertUploadId(uploadId)
  return path.join(root, 'sessions', uploadId)
}

function metaPath(root, uploadId) {
  return path.join(sessionDir(root, uploadId), 'meta.json')
}

async function readMeta(root, uploadId) {
  try {
    const raw = await fs.readFile(metaPath(root, uploadId), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err?.code === 'ENOENT') {
      throw new AppError(
        'NOT_FOUND',
        'Upload session not found or expired — upload lại từ đầu',
        404,
      )
    }
    throw err
  }
}

async function writeMeta(root, uploadId, meta) {
  await fs.writeFile(metaPath(root, uploadId), JSON.stringify(meta))
}

export async function createUploadSession(root, { filename, fileSize }) {
  if (!filename || !fileSize) {
    throw new AppError('VALIDATION_ERROR', 'filename and fileSize required')
  }
  if (fileSize > MAX_IFC_BYTES) {
    throw new AppError('VALIDATION_ERROR', 'IFC file too large (max 500MB)', 413)
  }
  if (!/\.ifc$/i.test(filename)) {
    throw new AppError('VALIDATION_ERROR', 'File must be .ifc')
  }

  const uploadId = uuidv4()
  const dir = sessionDir(root, uploadId)
  await fs.mkdir(dir, { recursive: true })

  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES)
  const meta = {
    uploadId,
    filename,
    fileSize,
    chunkSize: CHUNK_SIZE_BYTES,
    totalChunks,
    received: [],
    createdAt: Date.now(),
  }
  await writeMeta(root, uploadId, meta)

  return { uploadId, chunkSize: CHUNK_SIZE_BYTES, totalChunks }
}

function partPath(root, uploadId, index) {
  return path.join(sessionDir(root, uploadId), `part-${String(index).padStart(6, '0')}`)
}

export async function saveChunk(root, uploadId, index, body) {
  const meta = await readMeta(root, uploadId)
  if (Date.now() - meta.createdAt > SESSION_TTL_MS) {
    throw new AppError('VALIDATION_ERROR', 'Upload session expired', 410)
  }

  const chunkIndex = Number(index)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new AppError('VALIDATION_ERROR', 'Invalid chunk index')
  }

  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body || [])
  if (buf.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Empty chunk body')
  }

  const isLast = chunkIndex === meta.totalChunks - 1
  const maxLen = isLast
    ? meta.fileSize - chunkIndex * meta.chunkSize
    : meta.chunkSize
  if (buf.length > maxLen) {
    throw new AppError('VALIDATION_ERROR', 'Chunk larger than expected')
  }

  try {
    await fs.mkdir(sessionDir(root, uploadId), { recursive: true })
    await fs.writeFile(partPath(root, uploadId, chunkIndex), buf)
  } catch (err) {
    if (err?.code === 'ENOSPC') {
      throw new AppError('SERVICE_UNAVAILABLE', 'Server disk full — cannot save chunk', 507)
    }
    throw err
  }

  if (!meta.received.includes(chunkIndex)) {
    meta.received.push(chunkIndex)
    meta.received.sort((a, b) => a - b)
    await writeMeta(root, uploadId, meta)
  }

  return {
    uploadId,
    chunkIndex,
    received: meta.received.length,
    totalChunks: meta.totalChunks,
  }
}

/** Pipe one readable into writable without closing writable (avoids MaxListeners on merge). */
function pipePart(readable, writable) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      readable.destroy()
      reject(err)
    }
    readable.once('error', onError)
    writable.once('error', onError)
    readable.once('end', resolve)
    readable.pipe(writable, { end: false })
  })
}

function finishWriteStream(writable) {
  return new Promise((resolve, reject) => {
    writable.once('finish', resolve)
    writable.once('error', reject)
    writable.end()
  })
}

export async function mergeChunksToFile(root, uploadId) {
  const meta = await readMeta(root, uploadId)
  if (meta.received.length !== meta.totalChunks) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Missing chunks (${meta.received.length}/${meta.totalChunks})`,
    )
  }

  const safeName = path.basename(meta.filename).replace(/[^\w.\-]+/g, '_')
  const mergedPath = path.join(sessionDir(root, uploadId), `merged-${safeName}`)
  const out = fsSync.createWriteStream(mergedPath)

  try {
    for (let i = 0; i < meta.totalChunks; i += 1) {
      const part = partPath(root, uploadId, i)
      if (!fsSync.existsSync(part)) {
        throw new AppError('VALIDATION_ERROR', `Missing chunk file ${i}`)
      }
      await pipePart(fsSync.createReadStream(part), out)
    }
    await finishWriteStream(out)
  } catch (err) {
    out.destroy()
    throw err
  }

  const stat = await fs.stat(mergedPath)
  if (stat.size !== meta.fileSize) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Merged size mismatch (got ${stat.size}, expected ${meta.fileSize})`,
    )
  }

  return { mergedPath, meta }
}

export async function removeSession(root, uploadId) {
  await fs.rm(sessionDir(root, uploadId), { recursive: true, force: true }).catch(() => {})
}
