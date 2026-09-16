import { apiFetch } from './client.js'

export function fetchUploadConfig() {
  return apiFetch('/uploads/config')
}

export function presignUpload({ filename, content_type, prefix }) {
  return apiFetch('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, content_type, prefix }),
  })
}

/** Upload file trực tiếp lên S3 qua presigned URL */
export async function uploadToS3(file, { prefix = 'uploads' } = {}) {
  const presign = await presignUpload({
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    prefix,
  })
  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error('S3 upload failed')
  return presign
}

const accessCache = new Map()

/** Presigned GET URL for private S3 objects (cached ~50 min). */
export async function resolveS3AccessUrl(urlOrKey, { download = false } = {}) {
  if (!urlOrKey) throw new Error('Missing url')
  const cacheKey = `${download ? 'd:' : 'v:'}${urlOrKey}`
  const hit = accessCache.get(cacheKey)
  if (hit && hit.exp > Date.now()) return hit.url

  const body = urlOrKey.includes('://')
    ? { url: urlOrKey, download }
    : { key: urlOrKey, download }
  const data = await apiFetch('/uploads/access', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  accessCache.set(cacheKey, { url: data.url, exp: Date.now() + 50 * 60 * 1000 })
  return data.url
}

export async function openS3Url(urlOrKey) {
  const href = await resolveS3AccessUrl(urlOrKey, { download: true })
  window.open(href, '_blank', 'noopener,noreferrer')
}
