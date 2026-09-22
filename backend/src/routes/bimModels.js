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
  ifcMultipart.fields([
    { name: 'ifc', maxCount: 1 },
    { name: 'preview', maxCount: 8 },
  ])(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('VALIDATION_ERROR', 'IFC file too large (max 500MB)', 413))
    }
    return next(new AppError('VALIDATION_ERROR', err.message || 'Upload failed', 400))
  })
}

router.post(
  '/upload-ifc',
  requireRole('admin', 'bql', 'engineer'),
  handleIfcUpload,
  asyncHandler(async (req, res) => {
    if (!isS3Configured()) {
      throw new AppError('SERVICE_UNAVAILABLE', 'S3 chưa được cấu hình trên server', 503)
    }

    const project_id = req.body.project_id
    const name = req.body.name?.trim() || null
    const version = req.body.version?.trim()
    const disciplineId = await resolveDisciplineId(queryOne, {
      discipline: req.body.discipline || 'architecture',
      discipline_id: req.body.discipline_id,
    })
    const description = req.body.description?.trim() || ''

    if (!project_id || !version) {
      throw new AppError('VALIDATION_ERROR', 'project_id and version required')
    }

    const project = await queryOne(
      'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [project_id],
    )
    if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

    await assertProjectAccess(req.user.sub, req.user.role, project_id)

    const ifcFile = req.files?.ifc?.[0]
    if (!ifcFile) throw new AppError('VALIDATION_ERROR', 'IFC file required')
    const ifcName = ifcFile.originalname || ''
    if (!/\.ifc$/i.test(ifcName) && !/ifc/i.test(ifcFile.mimetype || '')) {
      throw new AppError('VALIDATION_ERROR', 'File must be .ifc')
    }

    const previews = req.files?.preview || []

    const modelId = uuidv4()
    const workDir = path.join(ifcUploadRoot, modelId)
    const cleanup = [ifcFile.path, ...previews.map((p) => p.path)]

    let outputs
    try {
      await fs.mkdir(workDir, { recursive: true })
      outputs = await convertIfcToOutputs(ifcFile.path, workDir, 'model')
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
      const ifcBuf = await fs.readFile(ifcFile.path)
      const ifcUp = await uploadObject(`${prefix}/source.ifc`, ifcBuf, 'application/octet-stream')
      modelFiles.ifc_url = ifcUp.publicUrl

      const glbBuf = await fs.readFile(outputs.glbPath)
      const glbUp = await uploadObject(`${prefix}/model.glb`, glbBuf, 'model/gltf-binary')
      modelFiles.glb_url = glbUp.publicUrl
      modelFiles.asset_bundle_url = glbUp.publicUrl

      if (outputs.usdzPath) {
        const usdzBuf = await fs.readFile(outputs.usdzPath)
        const usdzUp = await uploadObject(`${prefix}/model.usdz`, usdzBuf, 'model/vnd.usdz+zip')
        modelFiles.usdz_url = usdzUp.publicUrl
      }

      const metaRaw = await fs.readFile(outputs.metadataPath, 'utf8')
      const metaUp = await uploadObject(`${prefix}/metadata.json`, metaRaw, 'application/json')
      modelFiles.metadata_url = metaUp.publicUrl

      const previewUrls = []
      for (let i = 0; i < previews.length; i += 1) {
        const prev = previews[i]
        const ext = path.extname(prev.originalname).toLowerCase() || '.jpg'
        const mime = prev.mimetype || 'image/jpeg'
        const buf = await fs.readFile(prev.path)
        const key = `${prefix}/preview-${i + 1}${ext}`
        const up = await uploadObject(key, buf, mime)
        previewUrls.push(up.publicUrl)
      }
      if (previewUrls.length) {
        modelFiles.preview_urls = previewUrls
        modelFiles.preview_url = previewUrls[0]
      }

      let fullMeta = {}
      try {
        fullMeta = JSON.parse(metaRaw)
      } catch {
        fullMeta = {}
      }
      /** Full element list lives on S3 metadata.json — DB keeps summary only (avoids max_allowed_packet). */
      const dbMetadata = {
        description: description || undefined,
        summary: fullMeta.summary,
        preview_urls: previewUrls.length ? previewUrls : undefined,
        metadata_url: modelFiles.metadata_url,
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
      res.status(201).json(model)
    } catch (err) {
      console.error('[upload-ifc] upload/db:', err)
      if (err instanceof AppError) throw err
      throw new AppError('UPLOAD_FAILED', err.message || 'S3 upload failed', 500)
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
      await removePaths(cleanup)
    }
  }),
)

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
