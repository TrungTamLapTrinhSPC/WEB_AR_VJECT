import express from 'express'
import cors from 'cors'
import { config } from './config/index.js'
import { connectRedis, disconnectRedis } from './redis/client.js'
import { pool } from './db/pool.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authenticate } from './middleware/auth.js'

import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import projectRoutes from './routes/projects.js'
import bimRoutes from './routes/bimModels.js'
import qrRoutes from './routes/qrMarkers.js'
import gpsRoutes from './routes/gpsPois.js'
import feedbackRoutes from './routes/feedbacks.js'
import userRoutes from './routes/users.js'
import searchRoutes from './routes/search.js'
import settingsRoutes from './routes/settings.js'
import auditRoutes from './routes/auditLogs.js'
import elementsRoutes from './routes/elements.js'
import companyGroupRoutes from './routes/companyGroups.js'
import disciplineRoutes from './routes/disciplines.js'
import uploadRoutes from './routes/uploads.js'
import notificationRoutes from './routes/notifications.js'
import backupRoutes from './routes/backup.js'
import projectAttributeGroupRoutes from './routes/projectAttributeGroups.js'

const app = express()

const IFC_CHUNK_BYTES = 5 * 1024 * 1024 + 1024

app.use(cors())

/** Binary IFC chunks (PUT) — parse before express.json */
app.use((req, res, next) => {
  const pathOnly = req.originalUrl.split('?')[0]
  const isIfcChunkPut = req.method === 'PUT'
    && /\/api\/v1\/bim-models\/upload-ifc\/chunk-session\/[^/]+\/chunk\/\d+$/.test(pathOnly)
  if (!isIfcChunkPut) return next()
  return express.raw({ type: () => true, limit: IFC_CHUNK_BYTES })(req, res, next)
})

app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/v1/auth', authRoutes)

// Auth routes apply `authenticate` per-handler; do not require JWT for all /auth/*
app.use('/api/v1', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next()
  return authenticate(req, res, next)
})

app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/projects', projectRoutes)
app.use('/api/v1/bim-models', bimRoutes)
app.use('/api/v1/qr-markers', qrRoutes)
app.use('/api/v1/gps-pois', gpsRoutes)
app.use('/api/v1/feedbacks', feedbackRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/audit-logs', auditRoutes)
app.use('/api/v1/elements', elementsRoutes)
app.use('/api/v1/company-groups', companyGroupRoutes)
app.use('/api/v1/disciplines', disciplineRoutes)
app.use('/api/v1/uploads', uploadRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/system/backup', backupRoutes)
app.use('/api/v1/project-attribute-groups', projectAttributeGroupRoutes)

app.use(errorHandler)

/** @type {import('http').Server | undefined} */
let server

async function shutdown() {
  if (server) {
    await new Promise((resolve) => server.close(() => resolve()))
  }
  await disconnectRedis()
  await pool.end()
  process.exit(0)
}

async function start() {
  try {
    await connectRedis()
    console.log('Redis connected')
  } catch (err) {
    console.warn('Redis unavailable — running without cache:', err.message)
  }

  try {
    await pool.query('SELECT 1')
  } catch (err) {
    const { host, port, database } = config.db
    console.error(
      `MySQL failed (${host}:${port}/${database}): ${err.message}`,
    )
    if (config.nodeEnv === 'development') {
      console.error(
        'Dev: point DB_HOST to 127.0.0.1 + DB_SSL=false for local MySQL, or allow your IP on the RDS security group.',
      )
    }
    throw err
  }
  console.log('MySQL connected')

  await new Promise((resolve, reject) => {
    server = app.listen(config.port, () => {
      console.log(`PA3 Admin API running on http://localhost:${config.port}`)
      console.log(`Docs: backend/API.md`)
      resolve()
    })
    server.on('error', reject)
  })
}

process.on('SIGINT', () => {
  shutdown().catch((err) => {
    console.error('Shutdown error:', err)
    process.exit(1)
  })
})

process.on('SIGTERM', () => {
  shutdown().catch((err) => {
    console.error('Shutdown error:', err)
    process.exit(1)
  })
})

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
