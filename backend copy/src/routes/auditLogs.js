import { Router } from 'express'
import { query } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters } from '../utils/cache.js'

const router = Router()

router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { search, action } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `audit-logs:list:${hashFilters({ search, action, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE 1=1'
  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR s.ip_address LIKE ?)'
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (action === 'LOGIN') {
    where += ' AND s.revoked_at IS NULL'
  } else if (action === 'LOGOUT') {
    where += ' AND s.revoked_at IS NOT NULL'
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 's')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT s.id, s.created_at, s.ip_address, s.user_agent, s.revoked_at,
            u.full_name AS user_name, u.email AS user_email,
            CASE WHEN s.revoked_at IS NOT NULL THEN 'LOGOUT' ELSE 'LOGIN' END AS action
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     ${where}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ?`,
    params,
  )

  const mapped = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    time: r.created_at,
    user: r.user_name,
    action: r.action,
    target: r.user_email,
    ip: r.ip_address || '—',
    status: 'ok',
  }))

  const result = paginatedResponse(mapped, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

export default router
