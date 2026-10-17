import QRCode from 'qrcode'
import { query } from '../db/pool.js'
import { uploadObject, isS3Configured } from './s3.js'

export function qrMarkerObjectKey(projectId, markerId) {
  return `qr-markers/${projectId}/${markerId}.png`
}

/** PNG buffer encoding marker_code (content scanned by AR app). */
export async function generateQrPngBuffer(text, width = 512) {
  return QRCode.toBuffer(String(text), {
    type: 'png',
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
}

/** Generate PNG, upload S3 if configured, update qr_markers.qr_image_url. */
export async function persistQrImage(markerId, projectId, markerCode) {
  const png = await generateQrPngBuffer(markerCode)
  let publicUrl = null

  if (isS3Configured()) {
    const key = qrMarkerObjectKey(projectId, markerId)
    const up = await uploadObject(key, png, 'image/png')
    publicUrl = up.publicUrl
  }

  if (publicUrl) {
    await query(
      'UPDATE qr_markers SET qr_image_url = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [publicUrl, markerId],
    )
  }

  return { png, publicUrl }
}
