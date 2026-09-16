import { parseJson } from './helpers'

/** All preview image URLs for a BIM row (model_files + metadata). */
export function getBimPreviewUrls(record) {
  const files = parseJson(record?.model_files, {}) || {}
  const meta = parseJson(record?.metadata, {}) || {}
  if (Array.isArray(files.preview_urls) && files.preview_urls.length) {
    return files.preview_urls.filter(Boolean)
  }
  if (files.preview_url) return [files.preview_url]
  if (Array.isArray(meta.preview_urls) && meta.preview_urls.length) {
    return meta.preview_urls.filter(Boolean)
  }
  if (files.thumbnail_url) return [files.thumbnail_url]
  return []
}

export function getBimFirstPreviewUrl(record) {
  return getBimPreviewUrls(record)[0] || null
}
