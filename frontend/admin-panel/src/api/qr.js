import { apiFetch, qs } from './client.js'

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
