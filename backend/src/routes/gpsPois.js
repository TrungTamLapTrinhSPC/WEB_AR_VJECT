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
  const { model_id, type, search } = req.query
  const cursor = req.query.cursor
  if (cursor && !decodeCursor(cursor)) throw new AppError('VALIDATION_ERROR', 'Invalid cursor')

  const cacheKey = `gps-pois:list:${hashFilters({ model_id, type, search, cursor, limit })}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const params = []
  let where = 'WHERE g.deleted_at IS NULL'
  if (model_id) { where += ' AND g.model_id = ?'; params.push(model_id) }
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
  const poi = await queryOne('SELECT * FROM gps_pois WHERE id = ? AND deleted_at IS NULL', [req.params.id])
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
  const { name, type, lat_wgs84, lng_wgs84, elevation, depth } = req.body
  await query(
    `UPDATE gps_pois SET name = COALESCE(?, name), type = COALESCE(?, type),
      lat_wgs84 = COALESCE(?, lat_wgs84), lng_wgs84 = COALESCE(?, lng_wgs84),
      elevation = COALESCE(?, elevation), depth = COALESCE(?, depth), updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [name ?? null, type ?? null, lat_wgs84 ?? null, lng_wgs84 ?? null, elevation ?? null, depth ?? null, req.params.id],
  )
  await invalidateResource('gps-pois', req.params.id)
  res.json(await queryOne('SELECT * FROM gps_pois WHERE id = ?', [req.params.id]))
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await query('UPDATE gps_pois SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  await invalidateResource('gps-pois', req.params.id)
  res.status(204).send()
}))

export default router
