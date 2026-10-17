import nodemailer from 'nodemailer'
import { config } from '../config/index.js'
import { AppError } from '../middleware/errorHandler.js'

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

export async function sendPasswordResetEmail(to, resetLink, ttlMinutes = 60) {
  const subject = 'PA3 — Đặt lại mật khẩu'
  const text = `Mở link sau để đặt lại mật khẩu (hiệu lực ${ttlMinutes} phút):\n${resetLink}`
  const html = `<p>Đặt lại mật khẩu PA3 Hybrid AR:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Link hết hạn sau ${ttlMinutes} phút.</p>`
  await sendGenericEmail({ to, subject, text, html })
}

export async function sendVerificationEmail(to, code) {
  const subject = 'PA3 — Mã kích hoạt tài khoản'
  const text = `Mã kích hoạt tài khoản PA3 Hybrid AR của bạn: ${code}\n\nMã có hiệu lực ${config.emailVerification.codeTtlMinutes} phút.`
  const html = `<p>Mã kích hoạt tài khoản <strong>PA3 Hybrid AR</strong>:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Mã có hiệu lực ${config.emailVerification.codeTtlMinutes} phút.</p>`

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
