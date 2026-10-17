import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  assertProjectAccess, assertCanAssignEngineers, isAdmin, isEngineer, seesAllProjects,
} from '../middleware/projectAccess.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import {
  cacheGet, cacheSet, hashFilters, invalidateResource,
} from '../utils/cache.js'
import { ensureModelsProjectFolder, isS3Configured } from '../utils/s3.js'
import { notifyProjectAssignment } from '../utils/notify.js'

const router = Router()

async function listProjects(req, res) {
  const limit = clampLimit(req.query.limit)
  const {
    status, search, company_group_id, start_date_from, start_date_to,
    end_date_from, end_date_to, attribute_group_id,
  } = req.query
  const cursor = req.query.cursor
  const userId = req.user.sub
  const role = req.user.role

  if (cursor && !decodeCursor(cursor)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor')
  }

  const filters = {
    status, search, company_group_id, start_date_from, start_date_to,
    end_date_from, end_date_to, attribute_group_id, cursor, limit, userId, role,
  }
  const cacheKey = `projects:list:${hashFilters(filters)}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let from = 'FROM projects p'
  let where = 'WHERE p.deleted_at IS NULL'

  if (isEngineer(role)) {
    from += ` INNER JOIN (
      SELECT DISTINCT ap.project_id FROM (
        SELECT project_id FROM project_users WHERE user_id = ?
        UNION
        SELECT pcg.project_id FROM project_company_groups pcg
        INNER JOIN users u ON u.company_group_id = pcg.company_group_id AND u.id = ?
      ) ap
    ) access ON access.project_id = p.id`
    params.push(userId, userId)
  }

  if (status) {
    where += ' AND p.status = ?'
    params.push(status)
  }
  if (search) {
    where += ' AND (p.name LIKE ? OR p.address LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  if (company_group_id) {
    where += ` AND EXISTS (
      SELECT 1 FROM project_company_groups pcg
      WHERE pcg.project_id = p.id AND pcg.company_group_id = ?
    )`
    params.push(company_group_id)
  }
  if (start_date_from) {
    where += ' AND p.start_date >= ?'
    params.push(start_date_from)
  }
  if (start_date_to) {
    where += ' AND p.start_date <= ?'
    params.push(start_date_to)
  }
  if (end_date_from) {
    where += ' AND p.end_date >= ?'
    params.push(end_date_from)
  }
  if (end_date_to) {
    where += ' AND p.end_date <= ?'
    params.push(end_date_to)
  }
  if (attribute_group_id) {
    where += ` AND EXISTS (
      SELECT 1 FROM project_attribute_group_links pagl
      WHERE pagl.project_id = p.id AND pagl.attribute_group_id = ?
    )`
    params.push(attribute_group_id)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'p')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT p.id, p.name, p.address, p.status, p.start_date, p.end_date, p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM qr_markers q WHERE q.project_id = p.id AND q.deleted_at IS NULL) AS qr_count,
            (SELECT COUNT(*) FROM bim_models b WHERE b.project_id = p.id AND b.deleted_at IS NULL) AS bim_count,
            (SELECT COUNT(*) FROM feedbacks f
               JOIN bim_models bm ON bm.id = f.models_id
               WHERE bm.project_id = p.id AND f.deleted_at IS NULL
                 AND f.status IN ('open','in_progress','pending')) AS open_feedback_count,
            (SELECT GROUP_CONCAT(cg.name ORDER BY cg.name SEPARATOR ', ')
               FROM project_company_groups pcg
               JOIN company_groups cg ON cg.id = pcg.company_group_id
               WHERE pcg.project_id = p.id) AS assigned_group_names,
            (SELECT GROUP_CONCAT(g.name ORDER BY g.name SEPARATOR ', ')
               FROM project_attribute_group_links pagl
               JOIN project_attribute_groups g ON g.id = pagl.attribute_group_id
               WHERE pagl.project_id = p.id) AS attribute_group_names,
            (SELECT GROUP_CONCAT(pagl.attribute_group_id ORDER BY g.name SEPARATOR ',')
               FROM project_attribute_group_links pagl
               JOIN project_attribute_groups g ON g.id = pagl.attribute_group_id
               WHERE pagl.project_id = p.id) AS attribute_group_ids
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
    `SELECT u.id, u.email, u.full_name, u.role, cg.name AS company_group_name, pu.created_at AS assigned_at
     FROM project_users pu
     JOIN users u ON u.id = pu.user_id
     LEFT JOIN company_groups cg ON cg.id = u.company_group_id
     WHERE pu.project_id = ? AND u.deleted_at IS NULL`,
    [req.params.id],
  )
  const groups = await query(
    `SELECT pcg.id, pcg.company_group_id, cg.name, pcg.created_at
     FROM project_company_groups pcg
     JOIN company_groups cg ON cg.id = pcg.company_group_id
     WHERE pcg.project_id = ?`,
    [req.params.id],
  )
  const attribute_groups = await query(
    `SELECT pagl.attribute_group_id AS id, g.name, g.color, pagl.created_at
     FROM project_attribute_group_links pagl
     JOIN project_attribute_groups g ON g.id = pagl.attribute_group_id
     WHERE pagl.project_id = ?`,
    [req.params.id],
  )
  res.json({ data: rows, groups, attribute_groups })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, address, status = 'active', start_date, end_date, engineer_ids = [] } = req.body
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required')

  const id = uuidv4()
  await query(
    `INSERT INTO projects (id, name, address, status, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, name, address || null, status, start_date || null, end_date || null],
  )

  for (const engineerId of engineer_ids) {
    await query(
      'INSERT INTO project_users (id, project_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [uuidv4(), id, engineerId],
    )
  }

  if (isS3Configured()) {
    try {
      await ensureModelsProjectFolder(id)
    } catch (err) {
      console.warn('[s3] ensureModelsProjectFolder:', err.message)
    }
  }

  await invalidateResource('projects')
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [id])
  res.status(201).json(project)
}))

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, address, status, start_date, end_date } = req.body
  const existing = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'Project not found', 404)

  await query(
    `UPDATE projects SET
       name = COALESCE(?, name), address = COALESCE(?, address), status = COALESCE(?, status),
       start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
       updated_at = NOW()
     WHERE id = ?`,
    [name ?? null, address ?? null, status ?? null, start_date ?? null, end_date ?? null, req.params.id],
  )

  await invalidateResource('projects', req.params.id)
  res.json(await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]))
}))

router.post('/:id/team', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)

  const { user_id } = req.body
  if (!user_id) throw new AppError('VALIDATION_ERROR', 'user_id is required')

  const project = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  const target = await queryOne(
    'SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL',
    [user_id],
  )
  if (!target) throw new AppError('NOT_FOUND', 'User not found', 404)
  if (target.role !== 'engineer') {
    throw new AppError('VALIDATION_ERROR', 'Chỉ gán kỹ sư (engineer) vào dự án')
  }

  const exists = await queryOne(
    'SELECT id FROM project_users WHERE project_id = ? AND user_id = ?',
    [req.params.id, user_id],
  )
  if (!exists) {
    await query(
      'INSERT INTO project_users (id, project_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [uuidv4(), req.params.id, user_id],
    )
    const project = await queryOne('SELECT name FROM projects WHERE id = ?', [req.params.id])
    notifyProjectAssignment(user_id, project?.name || req.params.id, req.params.id)
      .catch((err) => console.error('[notify] project assign:', err.message))
  }

  await invalidateResource('projects', req.params.id)
  res.status(201).json({ message: 'User assigned' })
}))

router.delete('/:id/team/:userId', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)
  await query('DELETE FROM project_users WHERE project_id = ? AND user_id = ?', [req.params.id, req.params.userId])
  await invalidateResource('projects', req.params.id)
  res.status(204).send()
}))

router.post('/:id/groups', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)

  const { company_group_id } = req.body
  if (!company_group_id) throw new AppError('VALIDATION_ERROR', 'company_group_id is required')

  const project = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  const group = await queryOne('SELECT id FROM company_groups WHERE id = ?', [company_group_id])
  if (!group) throw new AppError('NOT_FOUND', 'Company group not found', 404)

  const exists = await queryOne(
    'SELECT id FROM project_company_groups WHERE project_id = ? AND company_group_id = ?',
    [req.params.id, company_group_id],
  )
  if (!exists) {
    await query(
      'INSERT INTO project_company_groups (id, project_id, company_group_id, created_at) VALUES (?, ?, ?, NOW())',
      [uuidv4(), req.params.id, company_group_id],
    )
    const project = await queryOne('SELECT name FROM projects WHERE id = ?', [req.params.id])
    const engineers = await query(
      `SELECT id FROM users
       WHERE company_group_id = ? AND role = 'engineer' AND deleted_at IS NULL`,
      [company_group_id],
    )
    for (const eng of engineers) {
      notifyProjectAssignment(eng.id, project?.name || req.params.id, req.params.id)
        .catch((err) => console.error('[notify] project group assign:', err.message))
    }
  }

  await invalidateResource('projects', req.params.id)
  res.status(201).json({ message: 'Group assigned' })
}))

router.post('/:id/attribute-groups', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)

  const { attribute_group_id } = req.body
  if (!attribute_group_id) throw new AppError('VALIDATION_ERROR', 'attribute_group_id is required')

  const project = await queryOne('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!project) throw new AppError('NOT_FOUND', 'Project not found', 404)

  const group = await queryOne('SELECT id FROM project_attribute_groups WHERE id = ?', [attribute_group_id])
  if (!group) throw new AppError('NOT_FOUND', 'Attribute group not found', 404)

  const exists = await queryOne(
    'SELECT id FROM project_attribute_group_links WHERE project_id = ? AND attribute_group_id = ?',
    [req.params.id, attribute_group_id],
  )
  if (!exists) {
    await query(
      'INSERT INTO project_attribute_group_links (id, project_id, attribute_group_id, created_at) VALUES (?, ?, ?, NOW())',
      [uuidv4(), req.params.id, attribute_group_id],
    )
  }

  await invalidateResource('projects', req.params.id)
  res.status(201).json({ message: 'Attribute group assigned' })
}))

router.delete('/:id/attribute-groups/:groupId', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)
  await query(
    'DELETE FROM project_attribute_group_links WHERE project_id = ? AND attribute_group_id = ?',
    [req.params.id, req.params.groupId],
  )
  await invalidateResource('projects', req.params.id)
  res.status(204).send()
}))

router.delete('/:id/groups/:groupId', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  await assertCanAssignEngineers(req.user.sub, req.user.role)
  await query(
    'DELETE FROM project_company_groups WHERE project_id = ? AND company_group_id = ?',
    [req.params.id, req.params.groupId],
  )
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
