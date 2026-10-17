import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import { invalidateResource } from '../utils/cache.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT cg.id, cg.name, cg.created_at, cg.updated_at,
            (SELECT COUNT(*) FROM users u WHERE u.company_group_id = cg.id AND u.deleted_at IS NULL) AS user_count,
            (SELECT COUNT(*) FROM project_company_groups pcg WHERE pcg.company_group_id = cg.id) AS project_count
     FROM company_groups cg
     ORDER BY cg.name ASC`,
  )
  res.json({ data: rows })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const group = await queryOne(
    `SELECT cg.id, cg.name, cg.created_at, cg.updated_at,
            (SELECT COUNT(*) FROM users u WHERE u.company_group_id = cg.id AND u.deleted_at IS NULL) AS user_count,
            (SELECT COUNT(*) FROM project_company_groups pcg WHERE pcg.company_group_id = cg.id) AS project_count
     FROM company_groups cg WHERE cg.id = ?`,
    [req.params.id],
  )
  if (!group) throw new AppError('NOT_FOUND', 'Group not found', 404)

  const users = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.created_at
     FROM users u
     WHERE u.company_group_id = ? AND u.deleted_at IS NULL
     ORDER BY u.full_name ASC`,
    [req.params.id],
  )

  const projects = await query(
    `SELECT p.id, p.name, p.status, p.address, pcg.created_at AS assigned_at
     FROM project_company_groups pcg
     INNER JOIN projects p ON p.id = pcg.project_id AND p.deleted_at IS NULL
     WHERE pcg.company_group_id = ?
     ORDER BY p.name ASC`,
    [req.params.id],
  )

  res.json({ ...group, users, projects })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim()
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required')

  const dup = await queryOne('SELECT id FROM company_groups WHERE name = ?', [name])
  if (dup) throw new AppError('CONFLICT', 'Group name already exists', 409)

  const id = uuidv4()
  await query(
    'INSERT INTO company_groups (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
    [id, name],
  )
  await invalidateResource('users')
  res.status(201).json({ id, name })
}))

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim()
  if (!name) throw new AppError('VALIDATION_ERROR', 'name is required')

  const existing = await queryOne('SELECT id FROM company_groups WHERE id = ?', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'Group not found', 404)

  const dup = await queryOne(
    'SELECT id FROM company_groups WHERE name = ? AND id <> ?',
    [name, req.params.id],
  )
  if (dup) throw new AppError('CONFLICT', 'Group name already exists', 409)

  await query(
    'UPDATE company_groups SET name = ?, updated_at = NOW() WHERE id = ?',
    [name, req.params.id],
  )
  await invalidateResource('users')
  res.json(await queryOne(
    `SELECT cg.id, cg.name, cg.created_at, cg.updated_at,
            (SELECT COUNT(*) FROM users u WHERE u.company_group_id = cg.id AND u.deleted_at IS NULL) AS user_count,
            (SELECT COUNT(*) FROM project_company_groups pcg WHERE pcg.company_group_id = cg.id) AS project_count
     FROM company_groups cg WHERE cg.id = ?`,
    [req.params.id],
  ))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const group = await queryOne('SELECT id FROM company_groups WHERE id = ?', [req.params.id])
  if (!group) throw new AppError('NOT_FOUND', 'Group not found', 404)

  const users = await queryOne(
    'SELECT COUNT(*) AS c FROM users WHERE company_group_id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (users?.c > 0) {
    throw new AppError('CONFLICT', 'Group still has users assigned', 409)
  }

  const projects = await queryOne(
    'SELECT COUNT(*) AS c FROM project_company_groups WHERE company_group_id = ?',
    [req.params.id],
  )
  if (projects?.c > 0) {
    throw new AppError('CONFLICT', 'Group is still assigned to projects', 409)
  }

  await query('DELETE FROM company_groups WHERE id = ?', [req.params.id])
  await invalidateResource('users')
  res.status(204).send()
}))

export default router
