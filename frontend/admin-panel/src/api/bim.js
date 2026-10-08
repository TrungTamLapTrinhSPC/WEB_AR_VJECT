import { apiFetch, qs, API_BASE, ApiError } from './client.js'
import { uploadIfcFileInChunks, authFetch } from './chunkedUpload.js'

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

/** Upload IFC (chunked stream) → merge → convert → S3 models/{projectId}/{modelId}/ */
export async function uploadIfcBimModel({
  project_id, name, version, discipline, description, ifcFile, previewFiles,
  onProgress,
}) {
  const uploadId = await uploadIfcFileInChunks(ifcFile, {
    onProgress,
    createSession: (body) => apiFetch('/bim-models/upload-ifc/chunk-session', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  })

  const fd = new FormData()
  fd.append('project_id', project_id)
  if (name) fd.append('name', name)
  fd.append('version', version)
  fd.append('discipline', discipline)
  if (description) fd.append('description', description)
  previewFiles.forEach((file) => fd.append('preview', file))

  const res = await authFetch(
    `${API_BASE}/bim-models/upload-ifc/chunk-session/${uploadId}/complete`,
    { method: 'POST', body: fd },
  )

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
