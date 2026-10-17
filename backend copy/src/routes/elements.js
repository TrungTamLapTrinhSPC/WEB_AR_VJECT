import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import { clampLimit, paginatedResponse } from '../utils/cursor.js'
import { cacheGet, cacheSet, hashFilters, invalidateResource } from '../utils/cache.js'

const router = Router()

/**
 * Elements are derived from feedbacks.element_guid + BIM metadata.
 * Optional display style in bim_element_styles.
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
            MAX(f.id) AS sample_feedback_id,
            MAX(s.color_hex) AS color_hex,
            MAX(s.opacity_pct) AS opacity_pct
     FROM feedbacks f
     LEFT JOIN bim_models b ON b.id = f.models_id AND b.deleted_at IS NULL
     LEFT JOIN disciplines d ON d.id = b.discipline_id
     LEFT JOIN bim_element_styles s ON s.model_id = f.models_id AND s.element_guid = f.element_guid
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
    color_hex: r.color_hex || null,
    opacity_pct: r.opacity_pct != null ? Number(r.opacity_pct) : 100,
  }))

  if (discipline) {
    items = items.filter((e) => e.cat === discipline)
  }

  const result = paginatedResponse(items, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.patch('/:guid/style', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const guid = req.params.guid
  const { model_id, color_hex, opacity_pct } = req.body
  if (!model_id) throw new AppError('VALIDATION_ERROR', 'model_id is required')

  const color = String(color_hex || '#3B82F6').trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new AppError('VALIDATION_ERROR', 'color_hex must be #RRGGBB')
  }
  let opacity = Number(opacity_pct)
  if (!Number.isFinite(opacity)) opacity = 100
  opacity = Math.max(0, Math.min(100, Math.round(opacity)))

  const existing = await query(
    `SELECT id FROM bim_element_styles WHERE model_id = ? AND element_guid = ? LIMIT 1`,
    [model_id, guid],
  )

  if (existing.length) {
    await query(
      `UPDATE bim_element_styles SET color_hex = ?, opacity_pct = ?, updated_at = NOW() WHERE model_id = ? AND element_guid = ?`,
      [color, opacity, model_id, guid],
    )
  } else {
    await query(
      `INSERT INTO bim_element_styles (id, model_id, element_guid, color_hex, opacity_pct, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), model_id, guid, color, opacity],
    )
  }

  await invalidateResource('elements')
  res.json({ element_guid: guid, model_id, color_hex: color, opacity_pct: opacity })
}))

router.get('/:guid', asyncHandler(async (req, res) => {
  const guid = req.params.guid
  const modelId = req.query.model_id

  const rows = await query(
    `SELECT f.id, f.title, f.content, f.priority, f.status, f.images, f.created_at,
            f.models_id, b.name AS bim_name, b.version AS bim_version,
            d.code AS discipline, d.name AS discipline_name,
            u.full_name AS user_name,
            s.color_hex, s.opacity_pct
     FROM feedbacks f
     LEFT JOIN bim_models b ON b.id = f.models_id AND b.deleted_at IS NULL
     LEFT JOIN disciplines d ON d.id = b.discipline_id
     LEFT JOIN users u ON u.id = f.user_id
     LEFT JOIN bim_element_styles s ON s.model_id = f.models_id AND s.element_guid = f.element_guid
     WHERE f.deleted_at IS NULL AND f.element_guid = ?
     ${modelId ? 'AND f.models_id = ?' : ''}
     ORDER BY f.created_at DESC
     LIMIT 20`,
    modelId ? [guid, modelId] : [guid],
  )

  const first = rows[0]
  res.json({
    id: guid,
    name: first?.title || guid,
    bim: formatBimLabel(first || {}),
    model_id: first?.models_id || modelId || null,
    cat: mapDiscipline(first?.discipline),
    maker: '—',
    status: 'active',
    fb: rows.length,
    sample_feedback_id: first?.id || null,
    color_hex: first?.color_hex || '#3B82F6',
    opacity_pct: first?.opacity_pct != null ? Number(first.opacity_pct) : 100,
    feedbacks: rows,
  })
}))

function formatBimLabel(row) {
  if (!row?.model_id && !row?.models_id) return null
  const name = row.bim_name != null ? String(row.bim_name).trim() : ''
  const version = row.bim_version != null ? String(row.bim_version).trim() : ''
  if (name) return name
  if (version) return version
  const mid = row.model_id || row.models_id
  return `${String(mid).slice(0, 8)}…`
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
