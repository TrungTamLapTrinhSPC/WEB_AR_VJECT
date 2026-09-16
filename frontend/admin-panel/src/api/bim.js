import { apiFetch, qs, API_BASE, getTokens, ApiError } from './client.js'

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

/** Upload IFC → server converts to GLB + USDZ + metadata → S3 models/{projectId}/{modelId}/ */
export async function uploadIfcBimModel({
  project_id, name, version, discipline, description, ifcFile, previewFiles,
}) {
  const fd = new FormData()
  fd.append('project_id', project_id)
  if (name) fd.append('name', name)
  fd.append('version', version)
  fd.append('discipline', discipline)
  if (description) fd.append('description', description)
  fd.append('ifc', ifcFile)
  previewFiles.forEach((file) => fd.append('preview', file))

  const { access } = getTokens()
  const headers = {}
  if (access) headers.Authorization = `Bearer ${access}`

  const res = await fetch(`${API_BASE}/bim-models/upload-ifc`, {
    method: 'POST',
    headers,
    body: fd,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      data.error?.code || 'ERROR',
      data.error?.message || res.statusText,
      res.status,
    )
  }
  return data
}
