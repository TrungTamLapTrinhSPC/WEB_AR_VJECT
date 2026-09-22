import { Router } from 'express'
import { query } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { clampLimit, paginatedResponse } from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters } from '../utils/cache.js'

const router = Router()

/**
 * Elements are derived from feedbacks.element_guid + BIM metadata.
 * Phase-1: no dedicated bim_elements table.
 */
router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit, 100, 50)
  const { model_id, search, discipline } = req.query

  const cacheKey = `elements:list:${hashFilters({ model_id, search, discipline, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE f.deleted_at IS NULL AND f.element_guid IS NOT NULL AND f.element_guid != \'\''

  if (model_id) {
    where += ' AND f.models_id = ?'
    params.push(model_id)
  }
  if (search) {
    where += ' AND (f.element_guid LIKE ? OR f.title LIKE ? OR f.content LIKE ?)'
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  const rows = await query(
    `SELECT f.element_guid AS id,
            MAX(f.title) AS name,
            f.models_id AS model_id,
            MAX(b.name) AS bim_name,
            MAX(b.version) AS bim_version,
            MAX(d.code) AS discipline,
            MAX(d.name) AS discipline_name,
            COUNT(*) AS fb_count,
            MAX(f.status) AS last_status,
            MAX(f.created_at) AS created_at,
            MAX(f.id) AS sample_feedback_id
     FROM feedbacks f
     LEFT JOIN bim_models b ON b.id = f.models_id AND b.deleted_at IS NULL
     LEFT JOIN disciplines d ON d.id = b.discipline_id
     ${where}
     GROUP BY f.element_guid, f.models_id
     ORDER BY created_at DESC
     LIMIT ?`,
    [...params, limit + 1],
  )

  let items = rows.map((r) => ({
    id: r.id,
    name: r.name || r.id,
    cat: mapDiscipline(r.discipline),
    bim: formatBimLabel(r),
    model_id: r.model_id,
    maker: '—',
    status: r.last_status === 'resolved' || r.last_status === 'approved' ? 'active' : 'maint',
    fb: Number(r.fb_count) || 0,
    sample_feedback_id: r.sample_feedback_id || null,
    created_at: r.created_at,
  }))

  if (discipline) {
    items = items.filter((e) => e.cat === discipline)
  }

  const result = paginatedResponse(items, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:guid', asyncHandler(async (req, res) => {
  const guid = req.params.guid
  const rows = await query(
    `SELECT f.id, f.title, f.content, f.priority, f.status, f.images, f.created_at,
            f.models_id, b.name AS bim_name, b.version AS bim_version,
            d.code AS discipline, d.name AS discipline_name,
            u.full_name AS user_name
     FROM feedbacks f
     LEFT JOIN bim_models b ON b.id = f.models_id AND b.deleted_at IS NULL
     LEFT JOIN disciplines d ON d.id = b.discipline_id
     LEFT JOIN users u ON u.id = f.user_id
     WHERE f.deleted_at IS NULL AND f.element_guid = ?
     ORDER BY f.created_at DESC
     LIMIT 20`,
    [guid],
  )

  const first = rows[0]
  res.json({
    id: guid,
    name: first?.title || guid,
    bim: formatBimLabel(first || {}),
    model_id: first?.models_id || null,
    cat: mapDiscipline(first?.discipline),
    maker: '—',
    status: 'active',
    fb: rows.length,
    sample_feedback_id: first?.id || null,
    feedbacks: rows,
  })
}))

function formatBimLabel(row) {
  if (!row?.model_id) return null
  const name = row.bim_name != null ? String(row.bim_name).trim() : ''
  const version = row.bim_version != null ? String(row.bim_version).trim() : ''
  if (name) return name
  if (version) return version
  return `${String(row.model_id).slice(0, 8)}…`
}

function mapDiscipline(d) {
  if (!d) return 'water'
  const s = String(d).toLowerCase()
  if (s === 'hvac' || s.includes('mep') || s.includes('air')) return 'hvac'
  if (s === 'electrical' || s.includes('electr') || s.includes('power')) return 'electric'
  if (s === 'plumbing' || s.includes('plumb') || s.includes('water')) return 'water'
  if (s.includes('fire') || s.includes('pccc')) return 'fire'
  return 'water'
}

export default router
