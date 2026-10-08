import { API_BASE, getTokens, ApiError, refreshAccessToken } from './client.js'

async function authFetch(url, options = {}) {
  const { access } = getTokens()
  const headers = { ...options.headers }
  if (access) headers.Authorization = `Bearer ${access}`

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401 && access) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(url, { ...options, headers })
    }
  }

  return res
}

/**
 * Stream IFC file in binary chunks (PUT application/octet-stream).
 * @param {File} file
 * @param {(ev: { phase: string, loaded: number, total: number, percent: number, etaSeconds: number | null }) => void} [onProgress]
 */
export async function uploadIfcFileInChunks(file, { onProgress, createSession }) {
  const total = file.size
  const started = Date.now()
  let loaded = 0

  const emit = (phase, extra = {}) => {
    const elapsed = (Date.now() - started) / 1000
    const rate = loaded > 0 && elapsed > 0 ? loaded / elapsed : 0
    const etaSeconds = phase === 'upload' && rate > 0 ? (total - loaded) / rate : null
    onProgress?.({
      phase,
      loaded,
      total,
      percent: total ? Math.min(100, (loaded / total) * 100) : 0,
      etaSeconds,
      ...extra,
    })
  }

  emit('upload')

  const session = await createSession({
    filename: file.name,
    fileSize: total,
  })

  const { uploadId, chunkSize, totalChunks } = session

  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, total)
    const blob = file.slice(start, end)

    const url = `${API_BASE}/bim-models/upload-ifc/chunk-session/${uploadId}/chunk/${i}`
    const fd = new FormData()
    fd.append('chunk', blob, `part-${i}`)
    const res = await authFetch(url, {
      method: 'POST',
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

    loaded += blob.size
    emit('upload')
    // Yield so React can paint progress between chunks
    await new Promise((r) => { requestAnimationFrame(() => r()) })
  }

  emit('processing', { percent: 100, etaSeconds: null, loaded: total })
  return uploadId
}

export { authFetch, ApiError }
