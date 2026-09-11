import Redis from 'ioredis'
import { config } from '../config/index.js'

let redis = null

export function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })
  }
  return redis
}

export async function connectRedis() {
  const client = getRedis()
  if (client.status !== 'ready') {
    await client.connect()
  }
  return client
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
