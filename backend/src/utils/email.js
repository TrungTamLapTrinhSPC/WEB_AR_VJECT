import nodemailer from 'nodemailer'
import { config } from '../config/index.js'
import { AppError } from '../middleware/errorHandler.js'
import {
  normalizeLang,
  verificationEmail,
  passwordResetEmail,
} from './emailTemplates.js'

let transporter

function getTransporter() {
  if (!config.smtp.host) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    })
  }
  return transporter
}

export async function sendGenericEmail({ to, subject, text, html }) {
  const transport = getTransporter()
  if (!transport) {
    console.log(`[email-dev] To: ${to}\nSubject: ${subject}\n${text}`)
    return
  }
  try {
    await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html: html || text,
    })
  } catch (err) {
    console.error('[email] send failed:', err.message)
  }
}

export async function sendPasswordResetEmail(to, code, { ttlMinutes = 60, lang = 'vi' } = {}) {
  const { subject, text, html } = passwordResetEmail(lang, { code, ttlMinutes })
  await sendGenericEmail({ to, subject, text, html })
}

export async function sendVerificationEmail(to, code, { lang = 'vi' } = {}) {
  const ttl = config.emailVerification.codeTtlMinutes
  const { subject, text, html } = verificationEmail(lang, { code, ttlMinutes: ttl })

  const transport = getTransporter()
  if (!transport) {
    console.log(`[email-dev] Verification code for ${to}: ${code}`)
    return
  }

  try {
    await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    })
  } catch (err) {
    console.error('[email] send failed:', err.message)
    throw new AppError(
      'EMAIL_SEND_FAILED',
      'Không gửi được email xác minh. Kiểm tra cấu hình SMTP trên server hoặc thử lại sau.',
      503,
    )
  }
}

export { normalizeLang }

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function assertAllowedRegistrationEmail(email) {
  const normalized = String(email).trim().toLowerCase()
  if (!isValidEmail(normalized)) {
    throw new AppError('VALIDATION_ERROR', 'Email không hợp lệ')
  }
  if (config.emailVerification.requireGmail) {
    const domain = normalized.split('@')[1]
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      throw new AppError('VALIDATION_ERROR', 'Chỉ chấp nhận địa chỉ Gmail (@gmail.com)')
    }
  }
  return normalized
}
