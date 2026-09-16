import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  buildCursorClause, clampLimit, paginatedResponse, decodeCursor,
} from '../utils/cursor.js'
import { cacheGet, cacheSet, invalidateResource } from '../utils/cache.js'
import { generateQrPngBuffer, persistQrImage } from '../utils/qrImage.js'

const router = Router()

const MARKER_TYPES = new Set(['field', 'tabletop'])

function parseMarkerType(value, fallback = 'field') {
  const t = value == null || value === '' ? fallback : String(value)
  if (!MARKER_TYPES.has(t)) {
    throw new AppError('VALIDATION_ERROR', 'marker_type must be field or tabletop')
  }
  return t
}

function numOr(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const PATCH_FIELDS = [
  'floor_level', 'physical_width_m', 'bim_pos_x', 'bim_pos_y', 'bim_pos_z', 'qr_image_url',
  'marker_type', 'paper_size', 'tabletop_scale', 'offset_to_center_x', 'offset_to_center_z',
  'paper_rotation_y',
]

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { project_id, floor_level, search, marker_type } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')
  if (marker_type) parseMarkerType(marker_type)

  const params = []
  let where = 'WHERE q.deleted_at IS NULL'
  if (project_id) { where += ' AND q.project_id = ?'; params.push(project_id) }
  if (floor_level) { where += ' AND q.floor_level = ?'; params.push(floor_level) }
  if (marker_type) { where += ' AND q.marker_type = ?'; params.push(marker_type) }
  if (search) {
    where += ' AND (q.marker_code LIKE ? OR q.floor_level LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'q')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT q.*, p.name AS project_name
     FROM qr_markers q JOIN projects p ON p.id = q.project_id
     ${where}
     ORDER BY q.created_at DESC, q.id DESC LIMIT ?`,
    params,
  )

  res.json(paginatedResponse(rows, limit))
}))

router.get('/:id/qr-image', asyncHandler(async (req, res) => {
  const marker = await queryOne(
    'SELECT id, marker_code, qr_image_url FROM qr_markers WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!marker) throw new AppError('NOT_FOUND', 'QR marker not found', 404)

  const png = await generateQrPngBuffer(marker.marker_code)
  const safeName = String(marker.marker_code).replace(/[^\w.-]+/g, '_').slice(0, 80) || 'qr'
  res.set('Content-Type', 'image/png')
  res.set('Cache-Control', 'private, max-age=3600')
  res.set(
    'Content-Disposition',
    req.query.download === '1'
      ? `attachment; filename="${safeName}.png"`
      : `inline; filename="${safeName}.png"`,
  )
  res.send(png)
}))

router.post('/:id/generate-qr', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const marker = await queryOne(
    'SELECT id, project_id, marker_code FROM qr_markers WHERE id = ? AND deleted_at IS NULL',
    [req.params.id],
  )
  if (!marker) throw new AppError('NOT_FOUND', 'QR marker not found', 404)

  const { publicUrl } = await persistQrImage(marker.id, marker.project_id, marker.marker_code)
  await invalidateResource('qr-markers', marker.id)

  res.json(await queryOne(
    'SELECT q.*, p.name AS project_name FROM qr_markers q JOIN projects p ON p.id = q.project_id WHERE q.id = ?',
    [marker.id],
  ))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const cacheKey = `qr-markers:${req.params.id}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const marker = await queryOne(
    `SELECT q.*, p.name AS project_name FROM qr_markers q
     JOIN projects p ON p.id = q.project_id
     WHERE q.id = ? AND q.deleted_at IS NULL`,
    [req.params.id],
  )
  if (!marker) throw new AppError('NOT_FOUND', 'QR marker not found', 404)

  await cacheSet(cacheKey, marker, config.cache.detail)
  res.json(marker)
}))

router.post('/', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const {
    marker_code, project_id, floor_level, physical_width_m = 0.15,
    bim_pos_x = 0, bim_pos_y = 0, bim_pos_z = 0,
    paper_size = 'A3',
    tabletop_scale = 0.01,
    offset_to_center_x = 0.15,
    offset_to_center_z = -0.10,
    paper_rotation_y = 0,
  } = req.body
  const marker_type = parseMarkerType(req.body.marker_type)
  if (!marker_code || !project_id) {
    throw new AppError('VALIDATION_ERROR', 'marker_code and project_id required')
  }

  const id = uuidv4()
  await query(
    `INSERT INTO qr_markers (
      id, marker_code, project_id, floor_level, physical_width_m,
      bim_pos_x, bim_pos_y, bim_pos_z,
      marker_type, paper_size, tabletop_scale,
      offset_to_center_x, offset_to_center_z, paper_rotation_y,
      created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id, marker_code, project_id, floor_level || null, numOr(physical_width_m, 0.15),
      numOr(bim_pos_x, 0), numOr(bim_pos_y, 0), numOr(bim_pos_z, 0),
      marker_type, String(paper_size || 'A3').slice(0, 20),
      numOr(tabletop_scale, 0.01),
      numOr(offset_to_center_x, 0.15), numOr(offset_to_center_z, -0.10),
      numOr(paper_rotation_y, 0),
    ],
  )

  try {
    await persistQrImage(id, project_id, marker_code)
  } catch (err) {
    console.warn('[qr-markers] QR PNG generate/upload failed:', err.message)
  }

  await invalidateResource('qr-markers')
  res.status(201).json(await queryOne(
    `SELECT q.*, p.name AS project_name FROM qr_markers q
     JOIN projects p ON p.id = q.project_id WHERE q.id = ?`,
    [id],
  ))
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const sets = []
  const params = []
  for (const f of PATCH_FIELDS) {
    if (req.body[f] === undefined) continue
    if (f === 'marker_type') {
      sets.push(`${f} = ?`)
      params.push(parseMarkerType(req.body[f]))
      continue
    }
    if (f === 'paper_size') {
      sets.push(`${f} = ?`)
      params.push(String(req.body[f]).slice(0, 20))
      continue
    }
    const numeric = new Set([
      'physical_width_m', 'bim_pos_x', 'bim_pos_y', 'bim_pos_z',
      'tabletop_scale', 'offset_to_center_x', 'offset_to_center_z', 'paper_rotation_y',
    ])
    if (numeric.has(f)) {
      sets.push(`${f} = ?`)
      params.push(numOr(req.body[f], null))
      continue
    }
    sets.push(`${f} = ?`)
    params.push(req.body[f])
  }
  if (!sets.length) throw new AppError('VALIDATION_ERROR', 'No fields to update')

  params.push(req.params.id)
  await query(`UPDATE qr_markers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`, params)
  await invalidateResource('qr-markers', req.params.id)
  res.json(await queryOne(
    `SELECT q.*, p.name AS project_name FROM qr_markers q
     JOIN projects p ON p.id = q.project_id WHERE q.id = ?`,
    [req.params.id],
  ))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE qr_markers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('qr-markers', req.params.id)
  res.status(204).send()
}))

export default router
