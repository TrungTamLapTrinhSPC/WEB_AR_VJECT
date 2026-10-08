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
import { cacheGet, cacheSet, invalidateResource } from '../utils/cache.js'
import { assertAllowedRegistrationEmail } from '../utils/email.js'
import { assertStrongPassword } from '../utils/passwordPolicy.js'

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

const USER_ROLES = new Set(['admin', 'bql', 'engineer'])

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { role, search, company_group_id } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const params = []
  let where = 'WHERE u.deleted_at IS NULL'
  if (role) { where += ' AND u.role = ?'; params.push(role) }
  if (company_group_id) { where += ' AND u.company_group_id = ?'; params.push(company_group_id) }
  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.email LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'u')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.company_group_id, u.can_assign_engineers,
            u.email_verified_at, u.created_at, u.updated_at, cg.name AS company_group_name
     FROM users u
     LEFT JOIN company_groups cg ON cg.id = u.company_group_id
     ${where}
     ORDER BY u.created_at DESC, u.id DESC LIMIT ?`,
    params,
  )

  res.json(paginatedResponse(rows, limit))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await queryOne(
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.company_group_id, u.can_assign_engineers,
            u.email_verified_at, u.created_at, cg.name AS company_group_name
     FROM users u
     LEFT JOIN company_groups cg ON cg.id = u.company_group_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [req.params.id],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)

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
  const {
    email, password, full_name, role = 'engineer', language = 'vi', company_group_id,
    can_assign_engineers = false,
  } = req.body
  if (!email || !password || !full_name) {
    throw new AppError('VALIDATION_ERROR', 'email, password, full_name required')
  }

  assertStrongPassword(password)

  const normalizedEmail = assertAllowedRegistrationEmail(email)

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail])
  if (existing) throw new AppError('CONFLICT', 'Email already exists', 409)

  const id = uuidv4()
  const password_hash = await bcrypt.hash(password, 10)
  const assignFlag = role === 'bql' && can_assign_engineers ? 1 : 0

  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, language, company_group_id,
      email_verified_at, can_assign_engineers, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
    [id, normalizedEmail, password_hash, full_name, role, language, company_group_id || null, assignFlag],
  )

  await invalidateResource('users')
  res.status(201).json(await queryOne(
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.company_group_id, u.can_assign_engineers, cg.name AS company_group_name
     FROM users u LEFT JOIN company_groups cg ON cg.id = u.company_group_id WHERE u.id = ?`,
    [id],
  ))
}))

router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { full_name, role, language, company_group_id, can_assign_engineers } = req.body

  const existing = await queryOne(
    'SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!existing) throw new AppError('NOT_FOUND', 'User not found', 404)

  const sets = ['updated_at = NOW()']
  const params = []

  if (full_name !== undefined) {
    sets.push('full_name = ?')
    params.push(full_name)
  }
  if (role !== undefined) {
    if (!USER_ROLES.has(role)) {
      throw new AppError('VALIDATION_ERROR', 'role must be admin, bql, or engineer')
    }
    if (existing.role === 'admin' && role !== 'admin') {
      const adminCnt = (await queryOne(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND deleted_at IS NULL",
      ))?.cnt ?? 0
      if (adminCnt <= 1) {
        throw new AppError('VALIDATION_ERROR', 'Không thể đổi vai trò admin cuối cùng', 400)
      }
    }
    sets.push('role = ?')
    params.push(role)
  }
  if (language !== undefined) {
    sets.push('language = ?')
    params.push(language)
  }
  if (company_group_id !== undefined) {
    sets.push('company_group_id = ?')
    params.push(company_group_id || null)
  }
  if (can_assign_engineers !== undefined) {
    sets.push('can_assign_engineers = ?')
    params.push(can_assign_engineers ? 1 : 0)
  }

  if (sets.length === 1) {
    throw new AppError('VALIDATION_ERROR', 'No fields to update')
  }

  params.push(req.params.id)
  await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params,
  )
  await invalidateResource('users', req.params.id)
  res.json(await queryOne(
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.company_group_id, u.can_assign_engineers, cg.name AS company_group_name
     FROM users u LEFT JOIN company_groups cg ON cg.id = u.company_group_id WHERE u.id = ?`,
    [req.params.id],
  ))
}))

router.patch('/:id/password', requireRole('admin'), asyncHandler(async (req, res) => {
  const { password } = req.body
  if (!password) throw new AppError('VALIDATION_ERROR', 'password required')
  assertStrongPassword(password)

  const existing = await queryOne(
    'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!existing) throw new AppError('NOT_FOUND', 'User not found', 404)

  const password_hash = await bcrypt.hash(password, 10)
  await query(
    'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
    [password_hash, req.params.id],
  )
  await invalidateResource('users', req.params.id)
  res.json({ message: 'Password updated' })
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.sub) {
    throw new AppError('VALIDATION_ERROR', 'Không thể xóa tài khoản đang đăng nhập', 400)
  }

  const existing = await queryOne(
    'SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!existing) throw new AppError('NOT_FOUND', 'User not found', 404)

  if (existing.role === 'admin') {
    const adminCnt = (await queryOne(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND deleted_at IS NULL",
    ))?.cnt ?? 0
    if (adminCnt <= 1) {
      throw new AppError('VALIDATION_ERROR', 'Không thể xóa admin cuối cùng', 400)
    }
  }

  await query(
    'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  await invalidateResource('users', req.params.id)
  res.status(204).send()
}))

export default router
