import { apiFetch, qs } from './client.js'

export function fetchGpsPois(params = {}) {
  return apiFetch(`/gps-pois${qs(params)}`)
}

export function fetchGpsMap(params = {}) {
  return apiFetch(`/gps-pois/map${qs(params)}`)
}

export function fetchGpsPoi(id) {
  return apiFetch(`/gps-pois/${id}`)
}

export function createGpsPoi(body) {
  return apiFetch('/gps-pois', { method: 'POST', body: JSON.stringify(body) })
}

export function updateGpsPoi(id, body) {
  return apiFetch(`/gps-pois/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteGpsPoi(id) {
  return apiFetch(`/gps-pois/${id}`, { method: 'DELETE' })
}
