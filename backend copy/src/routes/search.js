import { Router } from 'express'
import { query } from '../db/pool.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { clampLimit, paginatedResponse, decodeCursor } from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters } from '../utils/cache.js'
import { config } from '../config/index.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const q = req.query.q?.trim()
  if (!q || q.length < 2) throw new AppError('VALIDATION_ERROR', 'Query must be at least 2 characters')

  const limit = clampLimit(req.query.limit, 20, 10)
  const cacheKey = `search:${hashFilters({ q, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const pattern = `%${q}%`
  const [projects, bim, qr, feedbacks, users] = await Promise.all([
    query('SELECT id, name AS label, "project" AS type, created_at FROM projects WHERE deleted_at IS NULL AND (name LIKE ? OR address LIKE ?) LIMIT 5', [pattern, pattern]),
    query('SELECT id, name AS label, "bim" AS type, created_at FROM bim_models WHERE deleted_at IS NULL AND (name LIKE ? OR version LIKE ?) LIMIT 5', [pattern, pattern]),
    query('SELECT id, marker_code AS label, "qr" AS type, created_at FROM qr_markers WHERE deleted_at IS NULL AND marker_code LIKE ? LIMIT 5', [pattern]),
    query('SELECT id, title AS label, "feedback" AS type, created_at FROM feedbacks WHERE deleted_at IS NULL AND (title LIKE ? OR content LIKE ?) LIMIT 5', [pattern, pattern]),
    query('SELECT id, full_name AS label, "user" AS type, created_at FROM users WHERE deleted_at IS NULL AND (full_name LIKE ? OR email LIKE ?) LIMIT 5', [pattern, pattern]),
  ])

  const combined = [...projects, ...bim, ...qr, ...feedbacks, ...users]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)

  const result = { data: combined, query: q }
  await cacheSet(cacheKey, result, 30)
  res.json(result)
}))

export default router
