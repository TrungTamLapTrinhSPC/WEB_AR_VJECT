import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authenticate } from '../middleware/auth.js'
import { cacheGet, cacheSet } from '../utils/cache.js'

const router = Router()

function signTokens(user) {
  const payload = { sub: user.id, email: user.email, role: user.role }
  const access_token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
  const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  })
  return { access_token, refresh_token, expires_in: 86400 }
}

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, language = 'vi' } = req.body
  if (!email || !password || !full_name) {
    throw new AppError('VALIDATION_ERROR', 'email, password, full_name required')
  }
  if (password.length < 6) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 6 characters')
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existing) throw new AppError('CONFLICT', 'Email already registered', 409)

  const id = uuidv4()
  const password_hash = await bcrypt.hash(password, 10)
  await query(
    'INSERT INTO users (id, email, password_hash, full_name, role, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [id, email, password_hash, full_name, 'engineer', language],
  )

  const user = { id, email, full_name, role: 'engineer', language }
  const tokens = signTokens(user)

  res.status(201).json({
    ...tokens,
    user,
  })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new AppError('VALIDATION_ERROR', 'Email and password required')
  }

  const user = await queryOne(
    'SELECT id, email, password_hash, full_name, role, language FROM users WHERE email = ? AND deleted_at IS NULL',
    [email],
  )
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401)
  }

  const tokens = signTokens(user)
  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + 86400 * 1000)
  const refreshExpiresAt = new Date(Date.now() + 30 * 86400 * 1000)

  await query(
    `INSERT INTO user_sessions (id, user_id, token, refresh_token, expires_at, refresh_expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, tokens.access_token, tokens.refresh_token, expiresAt, refreshExpiresAt, req.ip, req.headers['user-agent'] || ''],
  )

  res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      language: user.language,
    },
  })
}))

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [req.user.sub])
  res.json({ message: 'Logged out' })
}))

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body
  if (!refresh_token) throw new AppError('VALIDATION_ERROR', 'refresh_token required')

  let payload
  try {
    payload = jwt.verify(refresh_token, config.jwt.secret)
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401)
  }

  const session = await queryOne(
    'SELECT * FROM user_sessions WHERE refresh_token = ? AND revoked_at IS NULL AND refresh_expires_at > NOW()',
    [refresh_token],
  )
  if (!session) throw new AppError('UNAUTHORIZED', 'Session revoked or expired', 401)

  const user = await queryOne(
    'SELECT id, email, full_name, role, language FROM users WHERE id = ? AND deleted_at IS NULL',
    [payload.sub],
  )
  if (!user) throw new AppError('UNAUTHORIZED', 'User not found', 401)

  const tokens = signTokens(user)
  await query(
    'UPDATE user_sessions SET token = ?, refresh_token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id = ?',
    [tokens.access_token, tokens.refresh_token, session.id],
  )

  res.json(tokens)
}))

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const cacheKey = `auth:me:${req.user.sub}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const user = await queryOne(
    'SELECT id, email, full_name, role, language, created_at FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.user.sub],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)

  let project_ids = []
  if (user.role === 'engineer') {
    const rows = await query(
      'SELECT project_id FROM project_users WHERE user_id = ?',
      [user.id],
    )
    project_ids = rows.map((r) => r.project_id)
  }

  const payload = { ...user, project_ids }
  await cacheSet(cacheKey, payload, 60)
  res.json(payload)
}))

export default router
