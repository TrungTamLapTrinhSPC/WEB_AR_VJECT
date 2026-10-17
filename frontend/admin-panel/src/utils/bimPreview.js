import { parseJson } from './helpers'

/** All preview image URLs for a BIM row (model_files + metadata). */
export function getBimPreviewUrls(record) {
  const files = parseJson(record?.model_files, {}) || {}
  const meta = parseJson(record?.metadata, {}) || {}
  const urls = []
  const push = (u) => {
    if (u && !urls.includes(u)) urls.push(u)
  }
  if (Array.isArray(files.preview_urls)) files.preview_urls.forEach(push)
  push(files.preview_url)
  if (Array.isArray(meta.preview_urls)) meta.preview_urls.forEach(push)
  push(files.thumbnail_url)
  return urls
}

export function getBimFirstPreviewUrl(record) {
  return getBimPreviewUrls(record)[0] || null
}
