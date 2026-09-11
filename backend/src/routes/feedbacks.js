import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters, invalidateResource, cacheDel } from '../utils/cache.js'

const router = Router()

router.get('/board', asyncHandler(async (_req, res) => {
  const cacheKey = 'feedbacks:board'
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const rows = await query(
    `SELECT f.id, f.title, f.priority, f.status, f.created_at, f.images,
            u.full_name AS user_name, f.location_type, f.marker_id
     FROM feedbacks f JOIN users u ON u.id = f.user_id
     WHERE f.deleted_at IS NULL
     ORDER BY f.created_at DESC`,
  )

  const board = { open: [], in_progress: [], resolved: [], closed: [] }
  for (const row of rows) {
    if (['open', 'pending'].includes(row.status)) board.open.push(row)
    else if (row.status === 'in_progress') board.in_progress.push(row)
    else if (['resolved', 'approved'].includes(row.status)) board.resolved.push(row)
    else board.closed.push(row)
  }

  await cacheSet(cacheKey, board, config.cache.list)
  res.json(board)
}))

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { status, priority, user_id, search } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `feedbacks:list:${hashFilters({ status, priority, user_id, search, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE f.deleted_at IS NULL'
  if (status) { where += ' AND f.status = ?'; params.push(status) }
  if (priority) { where += ' AND f.priority = ?'; params.push(priority) }
  if (user_id) { where += ' AND f.user_id = ?'; params.push(user_id) }
  if (search) {
    where += ' AND (f.title LIKE ? OR f.content LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'f')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT f.id, f.title, f.content, f.priority, f.status, f.images, f.location_type,
            f.lat, f.lng, f.element_guid, f.created_at,
            u.full_name AS user_name, u.id AS user_id
     FROM feedbacks f JOIN users u ON u.id = f.user_id
     ${where}
     ORDER BY f.created_at DESC, f.id DESC LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `feedbacks:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const fb = await queryOne(
    `SELECT f.*, u.full_name AS user_name, u.email AS user_email
     FROM feedbacks f JOIN users u ON u.id = f.user_id
     WHERE f.id = ? AND f.deleted_at IS NULL`,
    [req.params.id],
  )
  if (!fb) throw new AppError('NOT_FOUND', 'Feedback not found', 404)

  await cacheSet(cacheKey, fb, config.cache.detail)
  res.json(fb)
}))

router.post('/', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const {
    models_id, title, content, priority = 'normal',
    location_type = 'gps', marker_id, lat, lng, images, element_guid,
  } = req.body
  const user_id = req.body.user_id || req.user.sub
  if (!content) {
    throw new AppError('VALIDATION_ERROR', 'content required')
  }

  const id = uuidv4()
  await query(
    `INSERT INTO feedbacks (id, user_id, models_id, title, content, priority, element_guid,
      images, location_type, marker_id, lat, lng, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW(), NOW())`,
    [id, user_id, models_id || null, title || null, content, priority, element_guid || null,
      images ? JSON.stringify(images) : null, location_type, marker_id || null, lat ?? null, lng ?? null],
  )

  await invalidateResource('feedbacks')
  await cacheDel('feedbacks:board')
  res.status(201).json(await queryOne('SELECT * FROM feedbacks WHERE id = ?', [id]))
}))

router.patch('/:id', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const { title, content, priority, status } = req.body
  await query(
    `UPDATE feedbacks SET title = COALESCE(?, title), content = COALESCE(?, content),
      priority = COALESCE(?, priority), status = COALESCE(?, status), updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [title ?? null, content ?? null, priority ?? null, status ?? null, req.params.id],
  )
  await invalidateResource('feedbacks', req.params.id)
  await cacheDel('feedbacks:board')
  res.json(await queryOne('SELECT * FROM feedbacks WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE feedbacks SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('feedbacks', req.params.id)
  res.status(204).send()
}))

export default router
