import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  assertProjectAccess, isAdmin, isEngineer, seesAllProjects,
} from '../middleware/projectAccess.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import {
  cacheGet, cacheSet, hashFilters, invalidateResource,
} from '../utils/cache.js'

const router = Router()

async function listProjects(req, res) {
  const limit = clampLimit(req.query.limit)
  const { status, search } = req.query
  const cursor = req.query.cursor
  const userId = req.user.sub
  const role = req.user.role

  if (cursor && !decodeCursor(cursor)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor')
  }

  const filters = { status, search, cursor, limit, userId, role }
  const cacheKey = `projects:list:${hashFilters(filters)}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let from = 'FROM projects p'
  let where = 'WHERE p.deleted_at IS NULL'

  if (isEngineer(role)) {
    from += ' INNER JOIN project_users pu ON pu.project_id = p.id AND pu.user_id = ?'
    params.push(userId)
  }

  if (status) {
    where += ' AND p.status = ?'
    params.push(status)
  }
  if (search) {
    where += ' AND (p.name LIKE ? OR p.address LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'p')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT p.id, p.name, p.address, p.status, p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM qr_markers q WHERE q.project_id = p.id AND q.deleted_at IS NULL) AS qr_count,
            (SELECT COUNT(*) FROM bim_models b WHERE b.project_id = p.id AND b.deleted_at IS NULL) AS bim_count,
            (SELECT COUNT(*) FROM feedbacks f
               JOIN bim_models bm ON bm.id = f.models_id
               WHERE bm.project_id = p.id AND f.deleted_at IS NULL
                 AND f.status IN ('open','in_progress','pending')) AS open_feedback_count
     ${from}
     ${where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}

router.get('/', asyncHandler(listProjects))

router.get('/:id', asyncHandler(async (req, res) => {
  await assertProjectAccess(req.user.sub, req.user.role, req.params.id)

  const cacheKey = `projects:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const project = await queryOne(
    'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  await cacheSet(cacheKey, project, config.cache.detail)
  res.json(project)
}))

router.get('/:id/stats', asyncHandler(async (req, res) => {
  await assertProjectAccess(req.user.sub, req.user.role, req.params.id)

  const cacheKey = `projects:${req.params.id}:stats`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const stats = {
    bim_models: (await queryOne('SELECT COUNT(*) AS cnt FROM bim_models WHERE project_id = ? AND deleted_at IS NULL', [req.params.id]))?.cnt ?? 0,
    qr_markers: (await queryOne('SELECT COUNT(*) AS cnt FROM qr_markers WHERE project_id = ? AND deleted_at IS NULL', [req.params.id]))?.cnt ?? 0,
    gps_pois: (await queryOne(
      `SELECT COUNT(*) AS cnt FROM gps_pois g
       JOIN bim_models b ON b.id = g.model_id
       WHERE b.project_id = ? AND g.deleted_at IS NULL`,
      [req.params.id],
    ))?.cnt ?? 0,
    open_feedbacks: (await queryOne(
      `SELECT COUNT(*) AS cnt FROM feedbacks f
       JOIN bim_models b ON b.id = f.models_id
       WHERE b.project_id = ? AND f.deleted_at IS NULL AND f.status IN ('open','in_progress','pending')`,
      [req.params.id],
    ))?.cnt ?? 0,
  }

  await cacheSet(cacheKey, stats, config.cache.dashboard)
  res.json(stats)
}))

router.get('/:id/team', asyncHandler(async (req, res) => {
  await assertProjectAccess(req.user.sub, req.user.role, req.params.id)

  const rows = await query(
    `SELECT u.id, u.email, u.full_name, u.role, pu.created_at AS assigned_at
     FROM project_users pu
     JOIN users u ON u.id = pu.user_id
     WHERE pu.project_id = ? AND u.deleted_at IS NULL`,
    [req.params.id],
  )
  res.json({ data: rows })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, address, status = 'active', engineer_ids = [] } = req.body
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required')

  const id = uuidv4()
  await query(
    'INSERT INTO projects (id, name, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [id, name, address || null, status],
  )

  for (const engineerId of engineer_ids) {
    await query(
      'INSERT INTO project_users (id, project_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [uuidv4(), id, engineerId],
    )
  }

  await invalidateResource('projects')
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [id])
  res.status(201).json(project)
}))

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, address, status } = req.body
  const existing = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'Project not found', 404)

  await query(
    'UPDATE projects SET name = COALESCE(?, name), address = COALESCE(?, address), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?',
    [name ?? null, address ?? null, status ?? null, req.params.id],
  )

  await invalidateResource('projects', req.params.id)
  res.json(await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]))
}))

router.post('/:id/team', requireRole('admin'), asyncHandler(async (req, res) => {
  const { user_id } = req.body
  if (!user_id) throw new AppError('VALIDATION_ERROR', 'user_id is required')

  const project = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  const exists = await queryOne(
    'SELECT id FROM project_users WHERE project_id = ? AND user_id = ?',
    [req.params.id, user_id],
  )
  if (!exists) {
    await query(
      'INSERT INTO project_users (id, project_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [uuidv4(), req.params.id, user_id],
    )
  }

  await invalidateResource('projects', req.params.id)
  res.status(201).json({ message: 'User assigned' })
}))

router.delete('/:id/team/:userId', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('DELETE FROM project_users WHERE project_id = ? AND user_id = ?', [req.params.id, req.params.userId])
  await invalidateResource('projects', req.params.id)
  res.status(204).send()
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const result = await query('UPDATE projects SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (result.affectedRows === 0) throw new AppError('NOT_FOUND', 'Project not found', 404)
  await invalidateResource('projects', req.params.id)
  res.status(204).send()
}))

export default router
