import { Router } from 'express'
import { config } from '../config/index.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import { cacheGet, cacheSet, cacheDel } from '../utils/cache.js'

const router = Router()
const SETTINGS_KEY = 'settings'

const DEFAULT_SETTINGS = {
  general: {
    org_name: 'RDSIC',
    org_tax: '0100109300',
    org_email: 'admin@rdsic.vn',
    org_tz: 'Asia/Ho_Chi_Minh',
    org_addr: 'Số 1 ABC, Hà Nội, Việt Nam',
    lang_sys: 'vi',
    lang_report_bilingual: true,
  },
  ar: {
    qr_confidence: 0.7,
    qr_timeout: 3,
    qr_extended_m: 15,
    qr_min_size_cm: 15,
    gps_auto_switch: true,
    gps_require_rtk: false,
    gps_kalman: false,
  },
  notifications: {
    push: true,
    email: true,
    sms: false,
  },
  integrations: {
    s3: { connected: true, detail: 'bucket: pa3-bim-storage · Singapore' },
    ntrip: { connected: false, detail: 'rtk.geodesy.gov.vn:2101' },
    datadog: { connected: true, detail: 'APM + logs' },
  },
  security: {
    password_min_length: 8,
    password_expiry_days: 90,
    require_special: true,
    admin_2fa: true,
    jwt_hours: 24,
    refresh_days: 30,
  },
}

router.get('/', asyncHandler(async (_req, res) => {
  const cached = await cacheGet(SETTINGS_KEY)
  if (cached) return res.json(cached)

  const settings = { ...DEFAULT_SETTINGS }
  await cacheSet(SETTINGS_KEY, settings, config.cache.settings)
  res.json(settings)
}))

router.patch('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const current = (await cacheGet(SETTINGS_KEY)) || { ...DEFAULT_SETTINGS }
  const next = {
    ...current,
    ...req.body,
    general: { ...current.general, ...(req.body.general || {}) },
    ar: { ...current.ar, ...(req.body.ar || {}) },
    notifications: { ...current.notifications, ...(req.body.notifications || {}) },
    integrations: { ...current.integrations, ...(req.body.integrations || {}) },
    security: { ...current.security, ...(req.body.security || {}) },
  }
  await cacheDel(SETTINGS_KEY)
  await cacheSet(SETTINGS_KEY, next, config.cache.settings)
  res.json(next)
}))

export default router
