import { apiFetch, qs } from './client.js'

export function fetchBimModels(params = {}) {
  return apiFetch(`/bim-models${qs(params)}`)
}

export function fetchBimModel(id) {
  return apiFetch(`/bim-models/${id}`)
}

export function fetchBimVersions(id, params = {}) {
  return apiFetch(`/bim-models/${id}/versions${qs(params)}`)
}

export function fetchBimFeedbacks(id, params = {}) {
  return apiFetch(`/bim-models/${id}/feedbacks${qs(params)}`)
}

export function createBimModel(body) {
  return apiFetch('/bim-models', { method: 'POST', body: JSON.stringify(body) })
}

export function updateBimModel(id, body) {
  return apiFetch(`/bim-models/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteBimModel(id) {
  return apiFetch(`/bim-models/${id}`, { method: 'DELETE' })
}
