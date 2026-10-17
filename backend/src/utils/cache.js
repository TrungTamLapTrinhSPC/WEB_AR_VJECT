import crypto from 'crypto'
import { getRedis } from '../redis/client.js'

export function hashFilters(filters) {
  const sorted = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      if (filters[key] !== undefined && filters[key] !== '') {
        acc[key] = filters[key]
      }
      return acc
    }, {})
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').slice(0, 12)
}

export async function cacheGet(key) {
  try {
    const raw = await getRedis().get(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value))
  } catch {
    // cache miss on error — non-blocking
  }
}

export async function cacheDel(...keys) {
  try {
    if (keys.length) await getRedis().del(...keys)
  } catch {
    // ignore
  }
}

/**
 * SCAN+DEL with keyPrefix is unreliable in ioredis (double-prefix / MATCH mismatch).
 * Prefer generation bump via invalidateResource — this is best-effort cleanup only.
 */
export async function cacheDelPattern(pattern) {
  try {
    const client = getRedis()
    const stream = client.scanStream({ match: pattern, count: 200 })
    const batch = []
    await new Promise((resolve, reject) => {
      stream.on('data', (keys) => {
        for (const key of keys) batch.push(key)
      })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    if (batch.length) {
      // Delete in chunks; keys from scanStream already have prefix stripped by ioredis
      for (let i = 0; i < batch.length; i += 100) {
        await client.del(...batch.slice(i, i + 100))
      }
    }
  } catch (err) {
    console.warn('[cache] cacheDelPattern failed:', pattern, err.message)
  }
}

async function getGeneration(resource) {
  try {
    const v = await getRedis().get(`${resource}:gen`)
    return v == null ? '0' : String(v)
  } catch {
    return '0'
  }
}

/** List cache key that auto-busts when invalidateResource bumps the generation. */
export async function listCacheKey(resource, filters) {
  const gen = await getGeneration(resource)
  return `${resource}:list:g${gen}:${hashFilters(filters)}`
}

/**
 * Bust all list caches for a resource by bumping a generation counter.
 * Old keys expire via TTL — no SCAN required (fixes Redis keyPrefix bugs).
 */
export async function invalidateResource(resource, id = null) {
  try {
    await getRedis().incr(`${resource}:gen`)
  } catch (err) {
    console.warn('[cache] incr gen failed:', resource, err.message)
  }

  if (id) await cacheDel(`${resource}:${id}`, `${resource}:${id}:stats`)
  if (resource === 'users') await cacheDel('users:stats')
  if (resource === 'feedbacks') await cacheDel('feedbacks:board')
  if (resource === 'projects' || resource === 'bim-models' || resource === 'qr-markers' || resource === 'feedbacks') {
    await cacheDel('dashboard:stats', 'dashboard:recent-feedback')
  }

  // Best-effort cleanup of old list keys (optional; gen bump already busts reads)
  await cacheDelPattern(`${resource}:list:*`)
}

/**
 * Wrap a handler with read-through cache.
 */
export function withCache(key, ttl, fetcher) {
  return async () => {
    const cached = await cacheGet(key)
    if (cached) return { ...cached, _cached: true }

    const data = await fetcher()
    await cacheSet(key, data, ttl)
    return data
  }
}
