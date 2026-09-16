import { apiFetch, apiFetchBlob, qs } from './client.js'

export function fetchQrMarkers(params = {}) {
  return apiFetch(`/qr-markers${qs(params)}`)
}

export function fetchQrMarker(id) {
  return apiFetch(`/qr-markers/${id}`)
}

export function createQrMarker(body) {
  return apiFetch('/qr-markers', { method: 'POST', body: JSON.stringify(body) })
}

export function updateQrMarker(id, body) {
  return apiFetch(`/qr-markers/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteQrMarker(id) {
  return apiFetch(`/qr-markers/${id}`, { method: 'DELETE' })
}

export function fetchQrMarkerImageBlob(id, { download = false } = {}) {
  const q = download ? '?download=1' : ''
  return apiFetchBlob(`/qr-markers/${id}/qr-image${q}`)
}

export function generateQrMarkerImage(id) {
  return apiFetch(`/qr-markers/${id}/generate-qr`, { method: 'POST' })
}

export function safeQrFileName(markerCode, markerId) {
  return `${String(markerCode || markerId).replace(/[^\w.-]+/g, '_')}.png`
}

/** Trigger browser download of QR PNG. */
export async function downloadQrMarkerPng(markerId, markerCode) {
  const blob = await fetchQrMarkerImageBlob(markerId, { download: true })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = safeQrFileName(markerCode, markerId)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

/** Open QR PNG in a new browser tab. */
export async function openQrMarkerInNewTab(markerId) {
  const blob = await fetchQrMarkerImageBlob(markerId)
  const href = URL.createObjectURL(blob)
  const w = window.open(href, '_blank', 'noopener,noreferrer')
  if (!w) URL.revokeObjectURL(href)
}
