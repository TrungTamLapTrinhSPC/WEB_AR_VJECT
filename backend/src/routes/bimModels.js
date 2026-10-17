import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import { assertProjectAccess } from '../middleware/projectAccess.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import {
  cacheGet, cacheSet, hashFilters, invalidateResource,
} from '../utils/cache.js'
import { convertIfcToOutputs } from '../utils/ifcConvert.js'
import {
  ensureModelsProjectFolder,
  isS3Configured,
  modelsObjectPrefix,
  uploadObject,
} from '../utils/s3.js'
import {
  BIM_DISCIPLINE_FIELDS,
  BIM_DISCIPLINE_JOIN,
  normalizeDisciplineCode,
  resolveDisciplineId,
} from '../utils/disciplines.js'
import {
  createUploadSession,
  saveChunk,
  mergeChunksToFile,
  removeSession,
  CHUNK_SIZE_BYTES,
} from '../utils/chunkUpload.js'

async function fetchBimRow(id) {
  return queryOne(
    `SELECT b.*, p.name AS project_name, ${BIM_DISCIPLINE_FIELDS}
     FROM bim_models b
     JOIN projects p ON p.id = b.project_id
     ${BIM_DISCIPLINE_JOIN}
     WHERE b.id = ? AND b.deleted_at IS NULL`,
    [id],
  )
}

const router = Router()

const ifcUploadRoot = path.join(os.tmpdir(), 'pa3-ifc-upload')
if (!fsSync.existsSync(ifcUploadRoot)) {
  fsSync.mkdirSync(ifcUploadRoot, { recursive: true })
}

const ifcMultipart = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ifcUploadRoot),
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}-${path.basename(file.originalname).replace(/[^\w.\-]+/g, '_')}`)
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
})

const chunkMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE_BYTES + 1024 },
})

function handleChunkMulter(err, next) {
  if (!err) return next()
  if (err.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError('VALIDATION_ERROR', 'Chunk too large (max 5MB)', 413))
  }
  return next(new AppError('VALIDATION_ERROR', err.message || 'Chunk upload failed', 400))
}

async function saveChunkFromRequest(req, res) {
  let buf = req.file?.buffer
  if (!buf && Array.isArray(req.files) && req.files[0]?.buffer) {
    buf = req.files[0].buffer
  }
  if (!buf && req.files && typeof req.files === 'object') {
    const first = Object.values(req.files).flat()[0]
    if (first?.buffer) buf = first.buffer
  }
  if (!buf && Buffer.isBuffer(req.body) && req.body.length) {
    buf = req.body
  }
  if (!buf?.length) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Chunk body empty — dùng POST multipart field "chunk" hoặc tăng nginx client_max_body_size',
      400,
    )
  }
  const result = await saveChunk(ifcUploadRoot, req.params.uploadId, req.params.index, buf)
  res.json(result)
}

async function removePaths(paths) {
  await Promise.all(paths.filter(Boolean).map((p) => fs.unlink(p).catch(() => {})))
}

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { project_id, discipline, search } = req.query
  const cursor = req.query.cursor

  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const filters = { project_id, discipline, search, cursor, limit }
  const cacheKey = `bim-models:list:${hashFilters(filters)}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE b.deleted_at IS NULL'

  if (project_id) { where += ' AND b.project_id = ?'; params.push(project_id) }
  if (discipline) {
    where += ' AND d.code = ?'
    params.push(normalizeDisciplineCode(discipline))
  }
  if (search) {
    where += ' AND (b.name LIKE ? OR b.version LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'b')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT b.id, b.project_id, b.name, b.version, b.discipline_id, b.model_files, b.metadata,
            b.uploaded_at, b.created_at, p.name AS project_name, ${BIM_DISCIPLINE_FIELDS}
     FROM bim_models b
     JOIN projects p ON p.id = b.project_id
     ${BIM_DISCIPLINE_JOIN}
     ${where}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

function handleIfcUpload(req, res, next) {
  ifcMultipart.any()(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('VALIDATION_ERROR', 'IFC file too large (max 500MB)', 413))
    }
    return next(new AppError('VALIDATION_ERROR', err.message || 'Upload failed', 400))
  })
}

function handlePreviewUpload(req, res, next) {
  ifcMultipart.any()(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('VALIDATION_ERROR', 'File too large (max 500MB)', 413))
    }
    return next(new AppError('VALIDATION_ERROR', err.message || 'Upload failed', 400))
  })
}

async function validateIfcUploadRequest(req, body) {
  if (!isS3Configured()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'S3 chưa được cấu hình trên server', 503)
  }

  const project_id = body.project_id
  const name = body.name?.trim() || null
  const version = body.version?.trim()
  const disciplineId = await resolveDisciplineId(queryOne, {
    discipline: body.discipline || 'architecture',
    discipline_id: body.discipline_id,
  })
  const description = body.description?.trim() || ''

  if (!project_id || !version) {
    throw new AppError('VALIDATION_ERROR', 'project_id and version required')
  }

  const project = await queryOne(
    'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
    [project_id],
  )
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  await assertProjectAccess(req.user.sub, req.user.role, project_id)

  let overrideDisciplineColors = false
  const rawOverride = body.override_discipline_colors ?? body.overrideDisciplineColors ?? req.query?.override_discipline_colors ?? req.query?.overrideDisciplineColors
  if (rawOverride === true || rawOverride === 'true' || rawOverride === '1' || rawOverride === 1) {
    overrideDisciplineColors = true
  } else if (typeof rawOverride === 'string' && rawOverride.trim()) {
    try {
      overrideDisciplineColors = JSON.parse(rawOverride)
    } catch {
      overrideDisciplineColors = rawOverride.split(',').map((s) => s.trim()).filter(Boolean)
    }
  } else if (Array.isArray(rawOverride) || (rawOverride && typeof rawOverride === 'object')) {
    overrideDisciplineColors = rawOverride
  }

  let boostColorVibrancy = true
  const rawBoost = body.boost_color_vibrancy ?? body.boostColorVibrancy ?? req.query?.boost_color_vibrancy ?? req.query?.boostColorVibrancy
  if (rawBoost === false || rawBoost === 'false' || rawBoost === '0' || rawBoost === 0) {
    boostColorVibrancy = false
  }

  return { project_id, name, version, disciplineId, description, overrideDisciplineColors, boostColorVibrancy }
}

async function processIfcAtPath(req, res, {
  ifcPath, ifcOriginalName, previews = [], project_id, name, version, disciplineId, description, overrideDisciplineColors, boostColorVibrancy = true, extraCleanup = [],
}) {
  const modelId = uuidv4()
  const workDir = path.join(ifcUploadRoot, modelId)
  const cleanup = [ifcPath, ...previews.map((p) => p.path), ...extraCleanup]

  const discRow = await queryOne('SELECT code FROM disciplines WHERE id = ?', [disciplineId])
  const disciplineCode = normalizeDisciplineCode(discRow?.code)

  const tStart = Date.now()
  console.log(`[upload-ifc] Model ${modelId}: Start processing "${ifcOriginalName || 'model.ifc'}" (project: ${project_id}, disc: ${disciplineCode})`)

  let outputs
  try {
    await fs.mkdir(workDir, { recursive: true })
    const tConvStart = Date.now()
    outputs = await convertIfcToOutputs(ifcPath, workDir, 'model', {
      discipline: disciplineCode,
      displayName: name || disciplineCode,
      overrideDisciplineColors,
      boostColorVibrancy,
    })
    console.log(`[upload-ifc] Model ${modelId}: IFC conversion completed in ${Date.now() - tConvStart}ms`)
  } catch (err) {
    console.error('[upload-ifc] conversion:', err)
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
    await removePaths(cleanup)
    throw new AppError('CONVERSION_FAILED', err.message || 'IFC conversion failed', 422)
  }

  const prefix = modelsObjectPrefix(project_id, modelId)
  await ensureModelsProjectFolder(project_id)

  const modelFiles = { s3_prefix: prefix }

  try {
    const tUpStart = Date.now()
    const ifcBuf = await fs.readFile(ifcPath)
    const glbBuf = await fs.readFile(outputs.glbPath)
    const metaRaw = await fs.readFile(outputs.metadataPath, 'utf8')

    let usdzBuf = null
    if (outputs.usdzPath) {
      usdzBuf = await fs.readFile(outputs.usdzPath).catch(() => null)
    }

    let psetsRaw = null
    if (outputs.psetsPath) {
      psetsRaw = await fs.readFile(outputs.psetsPath, 'utf8').catch(() => null)
    }

    const uploadTasks = [
      uploadObject(`${prefix}/source.ifc`, ifcBuf, 'application/octet-stream').then((up) => {
        modelFiles.ifc_url = up.publicUrl
      }),
      uploadObject(`${prefix}/model.glb`, glbBuf, 'model/gltf-binary').then((up) => {
        modelFiles.glb_url = up.publicUrl
        modelFiles.asset_bundle_url = up.publicUrl
      }),
      uploadObject(`${prefix}/metadata.json`, metaRaw, 'application/json').then((up) => {
        modelFiles.metadata_url = up.publicUrl
        modelFiles.metadata_version = outputs.metadataVersion ?? 2
      }),
    ]

    if (usdzBuf) {
      uploadTasks.push(
        uploadObject(`${prefix}/model.usdz`, usdzBuf, 'model/vnd.usdz+zip').then((up) => {
          modelFiles.usdz_url = up.publicUrl
        }),
      )
    }

    if (psetsRaw) {
      const psetsKey = `${prefix}/${outputs.discipline || disciplineCode}_psets.json`
      uploadTasks.push(
        uploadObject(psetsKey, psetsRaw, 'application/json').then((up) => {
          modelFiles.psets_url = up.publicUrl
        }),
      )
    }

    const previewUrls = new Array(previews.length)
    previews.forEach((prev, i) => {
      uploadTasks.push(
        (async () => {
          const ext = path.extname(prev.originalname).toLowerCase() || '.jpg'
          const mime = prev.mimetype || 'image/jpeg'
          const buf = await fs.readFile(prev.path)
          const key = `${prefix}/preview-${i + 1}${ext}`
          const up = await uploadObject(key, buf, mime)
          previewUrls[i] = up.publicUrl
        })(),
      )
    })

    await Promise.all(uploadTasks)
    console.log(`[upload-ifc] Model ${modelId}: S3 parallel uploads completed in ${Date.now() - tUpStart}ms`)

    const validPreviewUrls = previewUrls.filter(Boolean)
    if (validPreviewUrls.length) {
      modelFiles.preview_urls = validPreviewUrls
      modelFiles.preview_url = validPreviewUrls[0]
    }

    let fullMeta = {}
    try {
      fullMeta = JSON.parse(metaRaw)
    } catch {
      fullMeta = {}
    }
    const summary = fullMeta.version === 2
      ? {
        total_elements: fullMeta.elementsSummary?.total_elements,
        elements_with_geometry: fullMeta.elementsSummary?.elements_with_geometry,
        type_counts: fullMeta.elementsSummary?.type_counts,
        length_unit_scale_to_meters: fullMeta.unitScale,
        rtc_center_offset: fullMeta.rtcCenter,
      }
      : fullMeta.summary

    const dbMetadata = {
      description: description || undefined,
      metadata_version: fullMeta.version ?? outputs.metadataVersion ?? 2,
      summary,
      elementsSummary: fullMeta.elementsSummary,
      preview_urls: validPreviewUrls.length ? validPreviewUrls : undefined,
      metadata_url: modelFiles.metadata_url,
      psets_url: modelFiles.psets_url,
    }

    await query(
      `INSERT INTO bim_models (id, project_id, name, version, discipline_id, model_files, metadata, uploaded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [modelId, project_id, name, version, disciplineId,
        JSON.stringify(modelFiles),
        JSON.stringify(dbMetadata)],
    )

    await invalidateResource('bim-models')
    const model = await fetchBimRow(modelId)
    console.log(`[upload-ifc] Model ${modelId}: Total process finished in ${Date.now() - tStart}ms`)
    res.status(201).json(model)
  } catch (err) {
    console.error('[upload-ifc] upload/db:', err)
    if (err instanceof AppError) throw err
    throw new AppError('UPLOAD_FAILED', err.message || 'S3 upload failed', 500)
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
    await removePaths(cleanup)
  }
}

router.post(
  '/upload-ifc/chunk-session',
  requireRole('admin', 'bql', 'engineer'),
  asyncHandler(async (req, res) => {
    const { filename, fileSize } = req.body || {}
    const session = await createUploadSession(ifcUploadRoot, {
      filename: String(filename || ''),
      fileSize: Number(fileSize),
    })
    res.status(201).json({
      ...session,
      chunkSize: CHUNK_SIZE_BYTES,
    })
  }),
)

router.put(
  '/upload-ifc/chunk-session/:uploadId/chunk/:index',
  requireRole('admin', 'bql', 'engineer'),
  asyncHandler(saveChunkFromRequest),
)

router.post(
  '/upload-ifc/chunk-session/:uploadId/chunk/:index',
  requireRole('admin', 'bql', 'engineer'),
  (req, res, next) => chunkMem.any()(req, res, (err) => handleChunkMulter(err, next)),
  asyncHandler(saveChunkFromRequest),
)

router.post(
  '/upload-ifc/chunk-session/:uploadId/complete',
  requireRole('admin', 'bql', 'engineer'),
  handlePreviewUpload,
  asyncHandler(async (req, res) => {
    if (req.setTimeout) req.setTimeout(600000)
    if (res.setTimeout) res.setTimeout(600000)

    const fields = await validateIfcUploadRequest(req, req.body)
    const { uploadId } = req.params

    const allFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat()

    // Accept preview images under any field name ('preview', 'previews', 'image', 'file', etc.)
    // Filter out .ifc files in case client re-sent the source IFC file
    const previews = allFiles.filter((f) => {
      const ext = path.extname(f.originalname || '').toLowerCase()
      const isIfc = f.fieldname === 'ifc' || ext === '.ifc'
      return !isIfc
    })
    const extraCleanup = allFiles.filter((f) => !previews.includes(f)).map((f) => f.path).filter(Boolean)

    let mergedPath
    try {
      const merged = await mergeChunksToFile(ifcUploadRoot, uploadId)
      mergedPath = merged.mergedPath
      await processIfcAtPath(req, res, {
        ifcPath: mergedPath,
        ifcOriginalName: merged.meta.filename,
        previews,
        extraCleanup,
        ...fields,
      })
    } finally {
      await removeSession(ifcUploadRoot, uploadId)
    }
  }),
)

router.post(
  '/upload-ifc',
  requireRole('admin', 'bql', 'engineer'),
  handleIfcUpload,
  asyncHandler(async (req, res) => {
    if (req.setTimeout) req.setTimeout(600000)
    if (res.setTimeout) res.setTimeout(600000)

    const fields = await validateIfcUploadRequest(req, req.body)

    const allFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat()

    const ifcFile = allFiles.find((f) => f.fieldname === 'ifc' || /\.ifc$/i.test(f.originalname || ''))
      || (allFiles.length === 1 ? allFiles[0] : null)

    if (!ifcFile) throw new AppError('VALIDATION_ERROR', 'IFC file required')
    const ifcName = ifcFile.originalname || ''
    if (!/\.ifc$/i.test(ifcName) && !/ifc/i.test(ifcFile.mimetype || '')) {
      throw new AppError('VALIDATION_ERROR', 'File must be .ifc')
    }

    const previews = allFiles.filter((f) => f !== ifcFile)
    const extraCleanup = allFiles.filter((f) => f !== ifcFile && !previews.includes(f)).map((f) => f.path).filter(Boolean)

    await processIfcAtPath(req, res, {
      ifcPath: ifcFile.path,
      ifcOriginalName: ifcName,
      previews,
      extraCleanup,
      ...fields,
    })
  }),
)

router.get('/:id/offline-manifest', asyncHandler(async (req, res) => {
  const model = await fetchBimRow(req.params.id)
  if (!model) throw new AppError('NOT_FOUND', 'BIM model not found', 404)

  const files = typeof model.model_files === 'string'
    ? JSON.parse(model.model_files)
    : (model.model_files || {})

  const assets = []
  if (files.glb_url) assets.push({ type: 'glb', url: files.glb_url })
  if (files.usdz_url) assets.push({ type: 'usdz', url: files.usdz_url })
  if (files.asset_bundle_url) assets.push({ type: 'bundle', url: files.asset_bundle_url })
  if (files.ifc_url) assets.push({ type: 'ifc', url: files.ifc_url })

  let element_styles = []
  try {
    element_styles = await query(
      `SELECT element_guid, color_hex, opacity_pct FROM bim_element_styles WHERE model_id = ?`,
      [model.id],
    )
  } catch {
    element_styles = []
  }

  res.json({
    model_id: model.id,
    project_id: model.project_id,
    name: model.name,
    version: model.version,
    assets,
    metadata_url: files.metadata_url || null,
    psets_url: files.psets_url || null,
    metadata_version: files.metadata_version ?? null,
    element_styles,
    generated_at: new Date().toISOString(),
    note: 'Mobile app: cache these URLs locally for offline drawing view.',
  })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `bim-models:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const model = await fetchBimRow(req.params.id)
  if (!model) throw new AppError('NOT_FOUND', 'BIM model not found', 404)

  await cacheSet(cacheKey, model, config.cache.detail)
  res.json(model)
}))

router.get('/:id/versions', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const model = await queryOne('SELECT project_id FROM bim_models WHERE id = ?', [req.params.id])
  if (!model) throw new AppError('NOT_FOUND', 'BIM model not found', 404)

  const cursor = req.query.cursor
  const params = [model.project_id]
  let where = 'WHERE project_id = ? AND deleted_at IS NULL'
  const { clause, params: cursorParams } = buildCursorClause(cursor)
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT id, name, version, uploaded_at, created_at FROM bim_models ${where}
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    params,
  )
  res.json(paginatedResponse(rows, limit))
}))

router.get('/:id/feedbacks', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const cursor = req.query.cursor
  const params = [req.params.id]
  let where = 'WHERE f.models_id = ? AND f.deleted_at IS NULL'
  const { clause, params: cursorParams } = buildCursorClause(cursor, 'f')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT f.id, f.title, f.content, f.priority, f.status, f.images, f.created_at,
            u.full_name AS user_name
     FROM feedbacks f JOIN users u ON u.id = f.user_id
     ${where}
     ORDER BY f.created_at DESC, f.id DESC LIMIT ?`,
    params,
  )
  res.json(paginatedResponse(rows, limit))
}))

router.post('/', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const { project_id, name, version, discipline, discipline_id, model_files, metadata } = req.body
  if (!project_id || !version) throw new AppError('VALIDATION_ERROR', 'project_id and version required')

  const resolvedDisciplineId = await resolveDisciplineId(queryOne, { discipline, discipline_id })

  const id = uuidv4()
  await query(
    `INSERT INTO bim_models (id, project_id, name, version, discipline_id, model_files, metadata, uploaded_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [id, project_id, name || null, version, resolvedDisciplineId,
      model_files ? JSON.stringify(model_files) : null,
      metadata ? JSON.stringify(metadata) : null],
  )

  await invalidateResource('bim-models')
  res.status(201).json(await fetchBimRow(id))
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const { name, version, discipline, discipline_id, model_files, metadata } = req.body
  const existing = await queryOne('SELECT id FROM bim_models WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'BIM model not found', 404)

  let nextDisciplineId = null
  if (discipline_id != null || discipline != null) {
    nextDisciplineId = await resolveDisciplineId(queryOne, { discipline, discipline_id })
  }

  await query(
    `UPDATE bim_models SET
       name = COALESCE(?, name), version = COALESCE(?, version),
       discipline_id = COALESCE(?, discipline_id),
       model_files = COALESCE(?, model_files), metadata = COALESCE(?, metadata),
       updated_at = NOW()
     WHERE id = ?`,
    [name ?? null, version ?? null, nextDisciplineId,
      model_files ? JSON.stringify(model_files) : null,
      metadata ? JSON.stringify(metadata) : null,
      req.params.id],
  )

  await invalidateResource('bim-models', req.params.id)
  res.json(await fetchBimRow(req.params.id))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE bim_models SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('bim-models', req.params.id)
  res.status(204).send()
}))

export default router
