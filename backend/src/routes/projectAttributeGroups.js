import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import { invalidateResource } from '../utils/cache.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT g.id, g.name, g.color, g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM project_attribute_group_links l WHERE l.attribute_group_id = g.id) AS project_count
     FROM project_attribute_groups g
     ORDER BY g.name ASC`,
  )
  res.json({ data: rows })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const group = await queryOne(
    `SELECT g.id, g.name, g.color, g.created_at, g.updated_at,
            (SELECT COUNT(*) FROM project_attribute_group_links l WHERE l.attribute_group_id = g.id) AS project_count
     FROM project_attribute_groups g WHERE g.id = ?`,
    [req.params.id],
  )
  if (!group) throw new AppError('NOT_FOUND', 'Group not found', 404)

  const projects = await query(
    `SELECT p.id, p.name, p.status, p.address, l.created_at AS assigned_at
     FROM project_attribute_group_links l
     INNER JOIN projects p ON p.id = l.project_id AND p.deleted_at IS NULL
     WHERE l.attribute_group_id = ?
     ORDER BY p.name ASC`,
    [req.params.id],
  )

  res.json({ ...group, projects })
}))

router.post('/', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim()
  const color = String(req.body.color || '#3B82F6').trim()
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required')

  const dup = await queryOne('SELECT id FROM project_attribute_groups WHERE name = ?', [name])
  if (dup) throw new AppError('CONFLICT', 'Group name already exists', 409)

  const id = uuidv4()
  await query(
    'INSERT INTO project_attribute_groups (id, name, color, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [id, name, color.slice(0, 7)],
  )
  await invalidateResource('projects')
  res.status(201).json({ id, name, color })
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const name = req.body.name != null ? String(req.body.name).trim() : null
  const color = req.body.color != null ? String(req.body.color).trim().slice(0, 7) : null
  const existing = await queryOne('SELECT id FROM project_attribute_groups WHERE id = ?', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'Group not found', 404)

  if (name) {
    const dup = await queryOne(
      'SELECT id FROM project_attribute_groups WHERE name = ? AND id <> ?',
      [name, req.params.id],
    )
    if (dup) throw new AppError('CONFLICT', 'Group name already exists', 409)
    await query('UPDATE project_attribute_groups SET name = ?, updated_at = NOW() WHERE id = ?', [name, req.params.id])
  }
  if (color) {
    await query('UPDATE project_attribute_groups SET color = ?, updated_at = NOW() WHERE id = ?', [color, req.params.id])
  }

  await invalidateResource('projects')
  res.json(await queryOne('SELECT * FROM project_attribute_groups WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const links = await queryOne(
    'SELECT COUNT(*) AS cnt FROM project_attribute_group_links WHERE attribute_group_id = ?',
    [req.params.id],
  )
  if (Number(links?.cnt) > 0) {
    throw new AppError('CONFLICT', 'Group still has linked projects', 409)
  }
  const result = await query('DELETE FROM project_attribute_groups WHERE id = ?', [req.params.id])
  if (result.affectedRows === 0) throw new AppError('NOT_FOUND', 'Group not found', 404)
  await invalidateResource('projects')
  res.status(204).send()
}))

export default router
