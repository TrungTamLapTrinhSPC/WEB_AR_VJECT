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

export async function cacheDelPattern(pattern) {
  try {
    const client = getRedis()
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = next
      if (keys.length) await client.del(...keys)
    } while (cursor !== '0')
  } catch {
    // ignore
  }
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

export async function invalidateResource(resource, id = null) {
  await cacheDelPattern(`${resource}:list:*`)
  if (resource === 'users') await cacheDel('users:stats')
  if (id) await cacheDel(`${resource}:${id}`)
}
