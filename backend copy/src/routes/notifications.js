import { Router } from 'express'
import { query, queryOne } from '../db/pool.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { clampLimit, paginatedResponse } from '../utils/cursor.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true'

  const params = [req.user.sub]
  let where = 'WHERE user_id = ?'
  if (unreadOnly) where += ' AND read_at IS NULL'

  params.push(limit + 1)
  const rows = await query(
    `SELECT id, type, title, body, link_path, read_at, created_at
     FROM notifications
     ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
    params,
  )
  res.json(paginatedResponse(rows, limit))
}))

router.get('/unread-count', asyncHandler(async (req, res) => {
  const row = await queryOne(
    'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [req.user.sub],
  )
  res.json({ count: row?.cnt ?? 0 })
}))

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const row = await queryOne(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.sub],
  )
  if (!row) throw new AppError('NOT_FOUND', 'Notification not found', 404)
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ?', [req.params.id])
  res.json({ ok: true })
}))

router.post('/read-all', asyncHandler(async (req, res) => {
  await query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
    [req.user.sub],
  )
  res.json({ ok: true })
}))

export default router
