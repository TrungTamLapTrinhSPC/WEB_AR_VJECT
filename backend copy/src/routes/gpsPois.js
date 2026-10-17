import { Router } from 'express'
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

router.get('/map', asyncHandler(async (req, res) => {
  const { model_id, project_id } = req.query
  const cacheKey = `gps-pois:map:${hashFilters({ model_id, project_id })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE g.deleted_at IS NULL'
  if (model_id) { where += ' AND g.model_id = ?'; params.push(model_id) }
  if (project_id) {
    where += ' AND b.project_id = ?'
    params.push(project_id)
  }

  const rows = await query(
    `SELECT g.id, g.name, g.type, g.lat_wgs84, g.lng_wgs84, g.elevation
     FROM gps_pois g
     ${project_id ? 'JOIN bim_models b ON b.id = g.model_id' : ''}
     ${where}`,
    params,
  )

  const geojson = {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(r.lng_wgs84), Number(r.lat_wgs84)] },
      properties: { id: r.id, name: r.name, type: r.type, elevation: r.elevation },
    })),
  }

  await cacheSet(cacheKey, geojson, config.cache.dashboard)
  res.json(geojson)
}))

router.get('/', asyncHandler(async (req, res) => {
  const limit = clampLimit(req.query.limit)
  const { model_id, project_id, type, search } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `gps-pois:list:${hashFilters({ model_id, project_id, type, search, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE g.deleted_at IS NULL'
  if (model_id) { where += ' AND g.model_id = ?'; params.push(model_id) }
  if (project_id) { where += ' AND b.project_id = ?'; params.push(project_id) }
  if (type) { where += ' AND g.type = ?'; params.push(type) }
  if (search) { where += ' AND g.name LIKE ?'; params.push(`%${search}%`) }

  const { clause, params: cursorParams } = buildCursorClause(cursor, 'g')
  where += clause
  params.push(...cursorParams, limit + 1)

  const rows = await query(
    `SELECT g.*, b.name AS model_name, p.name AS project_name
     FROM gps_pois g
     LEFT JOIN bim_models b ON b.id = g.model_id
     LEFT JOIN projects p ON p.id = b.project_id
     ${where}
     ORDER BY g.created_at DESC, g.id DESC LIMIT ?`,
    params,
  )

  const result = paginatedResponse(rows, limit)
  await cacheSet(cacheKey, result, config.cache.list)
  res.json(result)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const poi = await queryOne(
    `SELECT g.*, b.name AS model_name, p.name AS project_name
     FROM gps_pois g
     LEFT JOIN bim_models b ON b.id = g.model_id
     LEFT JOIN projects p ON p.id = b.project_id
     WHERE g.id = ? AND g.deleted_at IS NULL`,
    [req.params.id],
  )
  if (!poi) throw new AppError('NOT_FOUND', 'GPS POI not found', 404)
  res.json(poi)
}))

router.post('/', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const { model_id, name, type, lat_wgs84, lng_wgs84, elevation, depth } = req.body
  if (!name || !type || lat_wgs84 == null || lng_wgs84 == null) {
    throw new AppError('VALIDATION_ERROR', 'name, type, lat_wgs84, lng_wgs84 required')
  }

  const id = uuidv4()
  await query(
    `INSERT INTO gps_pois (id, model_id, name, type, lat_wgs84, lng_wgs84, elevation, depth, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, model_id || null, name, type, lat_wgs84, lng_wgs84, elevation ?? null, depth ?? null],
  )

  await invalidateResource('gps-pois')
  res.status(201).json(await queryOne('SELECT * FROM gps_pois WHERE id = ?', [id]))
}))

router.patch('/:id', requireRole('admin', 'bql'), asyncHandler(async (req, res) => {
  const existing = await queryOne('SELECT id FROM gps_pois WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (!existing) throw new AppError('NOT_FOUND', 'GPS POI not found', 404)

  const { name, type, lat_wgs84, lng_wgs84, elevation, depth } = req.body
  const sets = []
  const params = []

  if (Object.prototype.hasOwnProperty.call(req.body, 'model_id')) {
    sets.push('model_id = ?')
    params.push(req.body.model_id || null)
  }
  if (name != null) { sets.push('name = ?'); params.push(name) }
  if (type != null) { sets.push('type = ?'); params.push(type) }
  if (lat_wgs84 != null) { sets.push('lat_wgs84 = ?'); params.push(lat_wgs84) }
  if (lng_wgs84 != null) { sets.push('lng_wgs84 = ?'); params.push(lng_wgs84) }
  if (elevation !== undefined) {
    sets.push('elevation = ?')
    params.push(elevation === '' || elevation === null ? null : elevation)
  }
  if (depth !== undefined) {
    sets.push('depth = ?')
    params.push(depth === '' || depth === null ? null : depth)
  }

  if (sets.length) {
    sets.push('updated_at = NOW()')
    await query(
      `UPDATE gps_pois SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, req.params.id],
    )
  }

  await invalidateResource('gps-pois', req.params.id)
  const poi = await queryOne(
    `SELECT g.*, b.name AS model_name, p.name AS project_name
     FROM gps_pois g
     LEFT JOIN bim_models b ON b.id = g.model_id
     LEFT JOIN projects p ON p.id = b.project_id
     WHERE g.id = ?`,
    [req.params.id],
  )
  res.json(poi)
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE gps_pois SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('gps-pois', req.params.id)
  res.status(204).send()
}))

export default router
