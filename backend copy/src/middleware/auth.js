import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { AppError } from './errorHandler.js'

export function authenticate(req, _res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid token', 401))
  }

  try {
    const token = header.slice(7)
    req.user = jwt.verify(token, config.jwt.secret)
    next()
  } catch {
    next(new AppError('UNAUTHORIZED', 'Token expired or invalid', 401))
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError('UNAUTHORIZED', 'Not authenticated', 401))
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Insufficient permissions', 403))
    }
    next()
  }
}
