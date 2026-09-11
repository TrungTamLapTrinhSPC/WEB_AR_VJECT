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

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/v1/auth', authRoutes)

app.use('/api/v1', authenticate)

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

app.use(errorHandler)

async function start() {
  try {
    await connectRedis()
    console.log('Redis connected')
  } catch (err) {
    console.warn('Redis unavailable — running without cache:', err.message)
  }

  await pool.query('SELECT 1')
  console.log('MySQL connected')

  app.listen(config.port, () => {
    console.log(`PA3 Admin API running on http://localhost:${config.port}`)
    console.log(`Docs: backend/API.md`)
  })
}

process.on('SIGINT', async () => {
  await disconnectRedis()
  await pool.end()
  process.exit(0)
})

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
