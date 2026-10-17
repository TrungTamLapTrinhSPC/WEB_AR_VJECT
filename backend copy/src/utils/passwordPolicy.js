import { config } from '../config/index.js'
import { AppError } from '../middleware/errorHandler.js'

const SPECIAL_RE = /[^A-Za-z0-9]/

export function getPasswordPolicy() {
  return { ...config.password }
}

export function checkPassword(password) {
  const p = String(password ?? '')
  const { minLength, requireUpper, requireLower, requireDigit, requireSpecial } = config.password
  const failed = []

  if (p.length < minLength) {
    failed.push({ code: 'MIN_LENGTH', minLength })
  }
  if (requireUpper && !/[A-Z]/.test(p)) {
    failed.push({ code: 'UPPER' })
  }
  if (requireLower && !/[a-z]/.test(p)) {
    failed.push({ code: 'LOWER' })
  }
  if (requireDigit && !/[0-9]/.test(p)) {
    failed.push({ code: 'DIGIT' })
  }
  if (requireSpecial && !SPECIAL_RE.test(p)) {
    failed.push({ code: 'SPECIAL' })
  }

  return failed
}

const MESSAGES_VI = {
  MIN_LENGTH: (min) => `Mật khẩu tối thiểu ${min} ký tự`,
  UPPER: 'Cần ít nhất 1 chữ in hoa (A–Z)',
  LOWER: 'Cần ít nhất 1 chữ thường (a–z)',
  DIGIT: 'Cần ít nhất 1 chữ số (0–9)',
  SPECIAL: 'Cần ít nhất 1 ký tự đặc biệt (!@#$…)',
}

export function assertStrongPassword(password) {
  const failed = checkPassword(password)
  if (!failed.length) return

  const first = failed[0]
  const message = first.code === 'MIN_LENGTH'
    ? MESSAGES_VI.MIN_LENGTH(first.minLength)
    : MESSAGES_VI[first.code]

  throw new AppError('VALIDATION_ERROR', message, 400, failed)
}
