import { Router } from 'express'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { cacheGet, cacheSet } from '../utils/cache.js'
import { clampLimit } from '../utils/cursor.js'

const router = Router()

router.get('/stats', asyncHandler(async (_req, res) => {
  const cacheKey = 'dashboard:stats'
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const [projects, bim, qr, feedbacks, users] = await Promise.all([
    queryOne("SELECT COUNT(*) AS cnt FROM projects WHERE deleted_at IS NULL AND status = 'active'"),
    queryOne('SELECT COUNT(*) AS cnt FROM bim_models WHERE deleted_at IS NULL'),
    queryOne('SELECT COUNT(*) AS cnt FROM qr_markers WHERE deleted_at IS NULL'),
    queryOne("SELECT COUNT(*) AS cnt FROM feedbacks WHERE deleted_at IS NULL AND status IN ('open','in_progress','pending')"),
    queryOne('SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL'),
  ])

  const stats = {
    active_projects: projects?.cnt ?? 0,
    bim_models: bim?.cnt ?? 0,
    qr_markers: qr?.cnt ?? 0,
    open_feedbacks: feedbacks?.cnt ?? 0,
    online_engineers: users?.cnt ?? 0,
    changes: {
      projects_this_week: 0,
      bim_this_week: 0,
      qr_this_week: 0,
      feedbacks_today: 0,
    },
  }

  await cacheSet(cacheKey, stats, config.cache.dashboard)
  res.json(stats)
}))

router.get('/recent-feedbacks', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit, 10, 5)
  const rows = await query(
    `SELECT f.id, f.title, f.priority, f.status, f.created_at,
            u.full_name AS user_name
     FROM feedbacks f
     JOIN users u ON u.id = f.user_id
     WHERE f.deleted_at IS NULL
     ORDER BY f.created_at DESC
     LIMIT ?`,
    [limit],
  )
  res.json({ data: rows })
}))

router.get('/recent-bim', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit, 10, 4)
  const rows = await query(
    `SELECT b.id, b.name, b.version, b.discipline, b.uploaded_at, b.created_at,
            p.name AS project_name
     FROM bim_models b
     JOIN projects p ON p.id = b.project_id
     WHERE b.deleted_at IS NULL
     ORDER BY b.created_at DESC
     LIMIT ?`,
    [limit],
  )
  res.json({ data: rows })
}))

router.get('/priority-distribution', asyncHandler(async (_req, res) => {
  const cacheKey = 'dashboard:priority-dist'
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const rows = await query(
    `SELECT priority, COUNT(*) AS count
     FROM feedbacks WHERE deleted_at IS NULL
     GROUP BY priority`,
  )

  const map = { critical: 0, high: 0, normal: 0, low: 0 }
  for (const row of rows) {
    const key = row.priority === 'high' ? 'high' : row.priority
    if (map[key] !== undefined) map[key] = row.count
  }

  const result = { total: Object.values(map).reduce((a, b) => a + b, 0), distribution: map }
  await cacheSet(cacheKey, result, config.cache.dashboard)
  res.json(result)
}))

export default router
