import { Router } from 'express'
import { query } from '../db/pool.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { cacheGet, cacheSet } from '../utils/cache.js'
import { config } from '../config/index.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const cacheKey = 'disciplines:list'
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const rows = await query(
    'SELECT id, code, name, description, created_at, updated_at FROM disciplines ORDER BY id ASC',
  )
  const result = { data: rows }
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

export default router
