import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import {
  cacheGet, cacheSet, hashFilters, invalidateResource,
} from '../utils/cache.js'

const router = Router()

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
  if (discipline) { where += ' AND b.discipline = ?'; params.push(discipline) }
  if (search) {
    where += ' AND (b.name LIKE ? OR b.version LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'b')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT b.id, b.project_id, b.name, b.version, b.discipline, b.model_files, b.metadata,
            b.uploaded_at, b.created_at, p.name AS project_name
     FROM bim_models b
     JOIN projects p ON p.id = b.project_id
     ${where}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `bim-models:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const model = await queryOne(
    `SELECT b.*, p.name AS project_name
     FROM bim_models b JOIN projects p ON p.id = b.project_id
     WHERE b.id = ? AND b.deleted_at IS NULL`,
    [req.params.id],
  )
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
  const { project_id, name, version, discipline = 'other', model_files, metadata } = req.body
  if (!project_id || !version) throw new AppError('VALIDATION_ERROR', 'project_id and version required')

  const id = uuidv4()
  await query(
    `INSERT INTO bim_models (id, project_id, name, version, discipline, model_files, metadata, uploaded_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [id, project_id, name || null, version, discipline,
      model_files ? JSON.stringify(model_files) : null,
      metadata ? JSON.stringify(metadata) : null],
  )

  await invalidateResource('bim-models')
  const model = await queryOne('SELECT * FROM bim_models WHERE id = ?', [id])
  res.status(201).json(model)
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const { name, version, discipline, model_files, metadata } = req.body
  const existing = await queryOne('SELECT id FROM bim_models WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'BIM model not found', 404)

  await query(
    `UPDATE bim_models SET
       name = COALESCE(?, name), version = COALESCE(?, version),
       discipline = COALESCE(?, discipline),
       model_files = COALESCE(?, model_files), metadata = COALESCE(?, metadata),
       updated_at = NOW()
     WHERE id = ?`,
    [name ?? null, version ?? null, discipline ?? null,
      model_files ? JSON.stringify(model_files) : null,
      metadata ? JSON.stringify(metadata) : null,
      req.params.id],
  )

  await invalidateResource('bim-models', req.params.id)
  res.json(await queryOne('SELECT * FROM bim_models WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE bim_models SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('bim-models', req.params.id)
  res.status(204).send()
}))

export default router
