import { Router } from 'express'
import bcrypt from 'bcryptjs'
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

router.get('/stats', asyncHandler(async (_req, res) => {
  const cacheKey = 'users:stats'
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const stats = {
    total: (await queryOne('SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL'))?.cnt ?? 0,
    active: (await queryOne('SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL'))?.cnt ?? 0,
    engineers: (await queryOne("SELECT COUNT(*) AS cnt FROM users WHERE role = 'engineer' AND deleted_at IS NULL"))?.cnt ?? 0,
    partners: 0,
  }

  await cacheSet(cacheKey, stats, config.cache.dashboard)
  res.json(stats)
}))

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { role, search } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `users:list:${hashFilters({ role, search, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE deleted_at IS NULL'
  if (role) { where += ' AND role = ?'; params.push(role) }
  if (search) {
    where += ' AND (full_name LIKE ? OR email LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor)
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT id, email, full_name, role, language, created_at, updated_at
     FROM users ${where}
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `users:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const user = await queryOne(
    'SELECT id, email, full_name, role, language, created_at FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)

  await cacheSet(cacheKey, user, config.cache.detail)
  res.json(user)
}))

router.get('/:id/projects', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT p.id, p.name, p.status, pu.created_at AS assigned_at
     FROM project_users pu JOIN projects p ON p.id = pu.project_id
     WHERE pu.user_id = ? AND p.deleted_at IS NULL`,
    [req.params.id],
  )
  res.json({ data: rows })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { email, password, full_name, role = 'engineer', language = 'vi' } = req.body
  if (!email || !password || !full_name) {
    throw new AppError('VALIDATION_ERROR', 'email, password, full_name required')
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existing) throw new AppError('CONFLICT', 'Email already exists', 409)

  const id = uuidv4()
  const password_hash = await bcrypt.hash(password, 10)
  await query(
    'INSERT INTO users (id, email, password_hash, full_name, role, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [id, email, password_hash, full_name, role, language],
  )

  await invalidateResource('users')
  res.status(201).json(await queryOne('SELECT id, email, full_name, role, language FROM users WHERE id = ?', [id]))
}))

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { full_name, role, language } = req.body
  await query(
    'UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), language = COALESCE(?, language), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [full_name ?? null, role ?? null, language ?? null, req.params.id],
  )
  await invalidateResource('users', req.params.id)
  res.json(await queryOne('SELECT id, email, full_name, role, language FROM users WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('users', req.params.id)
  res.status(204).send()
}))

export default router
