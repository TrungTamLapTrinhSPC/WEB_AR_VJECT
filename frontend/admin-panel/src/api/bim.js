import { apiFetch, qs, API_BASE, ApiError, getTokens, refreshAccessToken, safeFetch } from './client.js'
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

/** Upload preview images to the model's S3 folder; returns { urls }. */
export async function uploadBimPreviewImages(modelId, files) {
  const list = (files || []).slice(0, 8)
  if (!list.length) return { urls: [] }

  const fd = new FormData()
  list.forEach((file) => fd.append('images', file, file.name))

  const { access } = getTokens()
  const headers = {}
  if (access) headers.Authorization = `Bearer ${access}`

  let res = await safeFetch(`${API_BASE}/bim-models/${modelId}/preview-images`, {
    method: 'POST',
    headers,
    body: fd,
  })

  if (res.status === 401 && access) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await safeFetch(`${API_BASE}/bim-models/${modelId}/preview-images`, {
        method: 'POST',
        headers,
        body: fd,
      })
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw ApiError.fromResponse(res, data)
  return data
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
  // Indexed field names — some reverse proxies keep only one part when names are duplicated
  ;(previewFiles || []).slice(0, 8).forEach((file, i) => {
    fd.append(`preview_${i}`, file, file.name)
  })

  const res = await authFetch(
    `${API_BASE}/bim-models/upload-ifc/chunk-session/${uploadId}/complete`,
    { method: 'POST', body: fd },
  )

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw ApiError.fromResponse(res, data)
  }
  if (!data.job_id) return data
  return waitForUploadJob(data.job_id, onProgress)
}

export function fetchUploadJob(jobId) {
  return apiFetch(`/bim-models/upload-jobs/${jobId}`)
}

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ERRORS = 5

/** Poll the server-side convert job until done; reports { phase: 'processing', percent, stage, etaSeconds }. */
async function waitForUploadJob(jobId, onProgress) {
  let startedAt = null
  let errors = 0
  for (;;) {
    await new Promise((r) => { setTimeout(r, POLL_INTERVAL_MS) })
    let job
    try {
      job = await fetchUploadJob(jobId)
      errors = 0
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) throw err
      errors += 1
      if (errors >= MAX_POLL_ERRORS) throw err
      continue
    }

    if (job.status === 'done') {
      onProgress?.({ phase: 'processing', percent: 100, stage: 'done', etaSeconds: 0 })
      return job.model
    }
    if (job.status === 'failed') {
      throw new ApiError(job.error?.code || 'UPLOAD_FAILED', job.error?.message || 'IFC upload failed', 422)
    }

    const percent = job.progress ?? 0
    if (job.status === 'processing' && startedAt == null) startedAt = Date.now()
    const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0
    const etaSeconds = percent >= 5 ? (elapsed * (100 - percent)) / percent : null
    onProgress?.({ phase: 'processing', percent, stage: job.stage, etaSeconds })
  }
}
