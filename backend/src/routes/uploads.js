import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { requireRole } from '../middleware/auth.js'
import {
  createPresignedUpload, createPresignedDownload, isS3Configured, keyFromPublicUrl,
} from '../utils/s3.js'

const router = Router()

router.get('/config', asyncHandler(async (_req, res) => {
  res.json({ s3_enabled: isS3Configured() })
}))

router.post('/presign', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const { filename, content_type, prefix = 'uploads' } = req.body
  if (!filename || !content_type) {
    throw new AppError('VALIDATION_ERROR', 'filename and content_type required')
  }
  if (!isS3Configured()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'S3 chưa được cấu hình trên server', 503)
  }

  const safeName = path.basename(String(filename)).replace(/[^\w.\-]+/g, '_')
  const key = `${prefix}/${uuidv4()}-${safeName}`
  const result = await createPresignedUpload(key, content_type)
  res.json(result)
}))

/** Presigned GET for private bucket objects (preview / download). */
router.post('/access', requireRole('admin', 'bql', 'engineer'), asyncHandler(async (req, res) => {
  const { key, url, download = false } = req.body
  if (!isS3Configured()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'S3 chưa được cấu hình trên server', 503)
  }

  const objectKey = key || keyFromPublicUrl(url)
  if (!objectKey) {
    throw new AppError('VALIDATION_ERROR', 'key or url required')
  }

  const signedUrl = await createPresignedDownload(objectKey)
  res.json({
    url: signedUrl,
    key: objectKey,
    download: !!download,
    expires_in: 3600,
  })
}))

export default router
