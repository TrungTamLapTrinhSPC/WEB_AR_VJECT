import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authenticate } from '../middleware/auth.js'
import { cacheGet, cacheSet, invalidateResource } from '../utils/cache.js'
import { getUserProjectIds } from '../utils/userProjects.js'
import {
  assertAllowedRegistrationEmail, isValidEmail, sendVerificationEmail, sendPasswordResetEmail,
} from '../utils/email.js'
import { assertStrongPassword, getPasswordPolicy } from '../utils/passwordPolicy.js'

const router = Router()

function signTokens(user, { remember = false } = {}) {
  const payload = { sub: user.id, email: user.email, role: user.role }
  const accessExp = remember ? '7d' : config.jwt.expiresIn
  const refreshExp = remember ? '90d' : config.jwt.refreshExpiresIn
  const access_token = jwt.sign(payload, config.jwt.secret, { expiresIn: accessExp })
  const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, config.jwt.secret, {
    expiresIn: refreshExp,
  })
  const expiresSec = remember ? 7 * 86400 : 86400
  return { access_token, refresh_token, expires_in: expiresSec }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function createEmailVerification(userId) {
  const code = generateCode()
  const id = uuidv4()
  const ttl = config.emailVerification.codeTtlMinutes
  await query('DELETE FROM user_email_verifications WHERE user_id = ?', [userId])
  await query(
    `INSERT INTO user_email_verifications (id, user_id, code, expires_at, created_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
    [id, userId, code, ttl],
  )
  return code
}

router.get('/password-policy', asyncHandler(async (_req, res) => {
  res.json(getPasswordPolicy())
}))

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, full_name, language = 'vi', company_group_id } = req.body
  if (!email || !password || !full_name) {
    throw new AppError('VALIDATION_ERROR', 'email, password, full_name required')
  }
  assertStrongPassword(password)

  const normalizedEmail = assertAllowedRegistrationEmail(email)

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail])
  if (existing) throw new AppError('CONFLICT', 'Email already registered', 409)

  const id = uuidv4()
  const password_hash = await bcrypt.hash(password, 10)
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, language, company_group_id, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'engineer', ?, ?, NULL, NOW(), NOW())`,
    [id, normalizedEmail, password_hash, full_name, language, company_group_id || null],
  )

  const code = await createEmailVerification(id)
  await sendVerificationEmail(normalizedEmail, code)
  await invalidateResource('users')

  res.status(201).json({
    requires_verification: true,
    email: normalizedEmail,
    message: 'Verification code sent to your email',
  })
}))

router.post('/verify-email', asyncHandler(async (req, res) => {
  const { email, code } = req.body
  if (!email || !code) throw new AppError('VALIDATION_ERROR', 'email and code required')
  if (!isValidEmail(email)) throw new AppError('VALIDATION_ERROR', 'Invalid email')

  const user = await queryOne(
    'SELECT id, email, full_name, role, language, email_verified_at FROM users WHERE email = ? AND deleted_at IS NULL',
    [email.trim().toLowerCase()],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  if (user.email_verified_at) {
    throw new AppError('VALIDATION_ERROR', 'Email already verified')
  }

  const row = await queryOne(
    `SELECT id FROM user_email_verifications
     WHERE user_id = ? AND code = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id, String(code).trim()],
  )
  if (!row) throw new AppError('VALIDATION_ERROR', 'Invalid or expired code', 400)

  await query('UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = ?', [user.id])
  await query('DELETE FROM user_email_verifications WHERE user_id = ?', [user.id])
  await invalidateResource('users', user.id)

  const tokens = signTokens(user)
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

router.post('/resend-verification', asyncHandler(async (req, res) => {
  const { email } = req.body
  if (!email || !isValidEmail(email)) throw new AppError('VALIDATION_ERROR', 'Valid email required')

  const user = await queryOne(
    'SELECT id, email, email_verified_at FROM users WHERE email = ? AND deleted_at IS NULL',
    [email.trim().toLowerCase()],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  if (user.email_verified_at) {
    throw new AppError('VALIDATION_ERROR', 'Email already verified')
  }

  const code = await createEmailVerification(user.id)
  await sendVerificationEmail(user.email, code)
  res.json({ message: 'Verification code resent' })
}))

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body
  if (!email || !isValidEmail(email)) {
    throw new AppError('VALIDATION_ERROR', 'Valid email required')
  }
  const normalized = email.trim().toLowerCase()
  const user = await queryOne(
    'SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL',
    [normalized],
  )
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const id = uuidv4()
    await query('DELETE FROM user_password_resets WHERE user_id = ?', [user.id])
    await query(
      `INSERT INTO user_password_resets (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 60 MINUTE), NOW())`,
      [id, user.id, tokenHash],
    )
    const base = process.env.FRONTEND_URL || process.env.ADMIN_PANEL_URL || 'http://localhost:5173'
    const resetLink = `${base.replace(/\/$/, '')}/reset-password?token=${rawToken}`
    await sendPasswordResetEmail(user.email, resetLink, 60)
  }
  res.json({ message: 'If the email exists, a reset link was sent' })
}))

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) {
    throw new AppError('VALIDATION_ERROR', 'token and password required')
  }
  assertStrongPassword(password)
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex')
  const row = await queryOne(
    `SELECT id, user_id FROM user_password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [tokenHash],
  )
  if (!row) throw new AppError('VALIDATION_ERROR', 'Invalid or expired reset link', 400)

  const password_hash = await bcrypt.hash(password, 10)
  await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [password_hash, row.user_id])
  await query('UPDATE user_password_resets SET used_at = NOW() WHERE id = ?', [row.id])
  await query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [row.user_id])
  res.json({ message: 'Password reset successful' })
}))

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { current_password, password } = req.body
  if (!current_password || !password) {
    throw new AppError('VALIDATION_ERROR', 'current_password and password required')
  }
  assertStrongPassword(password)
  const user = await queryOne(
    'SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL',
    [req.user.sub],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  if (!(await bcrypt.compare(String(current_password), user.password_hash))) {
    throw new AppError('VALIDATION_ERROR', 'Current password is incorrect', 400)
  }
  const password_hash = await bcrypt.hash(password, 10)
  await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [password_hash, user.id])
  await query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [user.id])
  res.json({ message: 'Password changed' })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password, remember_me: rememberMe } = req.body
  if (!email || !password) {
    throw new AppError('VALIDATION_ERROR', 'Email and password required')
  }

  const user = await queryOne(
    `SELECT id, email, password_hash, full_name, role, language, email_verified_at
     FROM users WHERE email = ? AND deleted_at IS NULL`,
    [email.trim().toLowerCase()],
  )
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401)
  }
  if (!user.email_verified_at) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email before login', 403)
  }

  const remember = rememberMe === true || rememberMe === 'true' || rememberMe === 1
  const tokens = signTokens(user, { remember })
  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  const refreshDays = remember ? 90 : 30
  const refreshExpiresAt = new Date(Date.now() + refreshDays * 86400 * 1000)

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
    'SELECT id, email, full_name, role, language, email_verified_at FROM users WHERE id = ? AND deleted_at IS NULL',
    [payload.sub],
  )
  if (!user || !user.email_verified_at) throw new AppError('UNAUTHORIZED', 'User not found', 401)

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
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.company_group_id, u.can_assign_engineers,
            u.email_verified_at, u.created_at, cg.name AS company_group_name
     FROM users u
     LEFT JOIN company_groups cg ON cg.id = u.company_group_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [req.user.sub],
  )
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)

  let project_ids = []
  if (user.role === 'engineer') {
    project_ids = await getUserProjectIds(user.id)
  }

  const payload = { ...user, project_ids }
  await cacheSet(cacheKey, payload, 60)
  res.json(payload)
}))

export default router
