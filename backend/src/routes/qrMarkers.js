import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters, invalidateResource } from '../utils/cache.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { project_id, floor_level, search } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `qr-markers:list:${hashFilters({ project_id, floor_level, search, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE q.deleted_at IS NULL'
  if (project_id) { where += ' AND q.project_id = ?'; params.push(project_id) }
  if (floor_level) { where += ' AND q.floor_level = ?'; params.push(floor_level) }
  if (search) {
    where += ' AND (q.marker_code LIKE ? OR q.floor_level LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'q')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT q.*, p.name AS project_name
     FROM qr_markers q JOIN projects p ON p.id = q.project_id
     ${where}
     ORDER BY q.created_at DESC, q.id DESC LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `qr-markers:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const marker = await queryOne(
    `SELECT q.*, p.name AS project_name FROM qr_markers q
     JOIN projects p ON p.id = q.project_id
     WHERE q.id = ? AND q.deleted_at IS NULL`,
    [req.params.id],
  )
  if (!marker) throw new AppError('NOT_FOUND', 'QR marker not found', 404)

  await cacheSet(cacheKey, marker, config.cache.detail)
  res.json(marker)
}))

router.post('/', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const {
    marker_code, project_id, floor_level, physical_width_m = 0.15,
    bim_pos_x = 0, bim_pos_y = 0, bim_pos_z = 0,
  } = req.body
  if (!marker_code || !project_id) {
    throw new AppError('VALIDATION_ERROR', 'marker_code and project_id required')
  }

  const id = uuidv4()
  await query(
    `INSERT INTO qr_markers (id, marker_code, project_id, floor_level, physical_width_m,
      bim_pos_x, bim_pos_y, bim_pos_z, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, marker_code, project_id, floor_level || null, physical_width_m, bim_pos_x, bim_pos_y, bim_pos_z],
  )

  await invalidateResource('qr-markers')
  res.status(201).json(await queryOne('SELECT * FROM qr_markers WHERE id = ?', [id]))
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const fields = ['floor_level', 'physical_width_m', 'bim_pos_x', 'bim_pos_y', 'bim_pos_z', 'qr_image_url']
  const sets = []
  const params = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'No fields to update')

  params.push(req.params.id)
  await query(`UPDATE qr_markers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`, params)
  await invalidateResource('qr-markers', req.params.id)
  res.json(await queryOne('SELECT * FROM qr_markers WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE qr_markers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('qr-markers', req.params.id)
  res.status(204).send()
}))

export default router
