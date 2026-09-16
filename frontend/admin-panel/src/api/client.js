/** Backend mounts routes under /api/v1 (see backend/src/index.js). */
export function normalizeApiBase(raw) {
  const base = (raw || '/api/v1').trim().replace(/\/$/, '')
  if (!base.startsWith('http')) return base.endsWith('/api/v1') ? base : `${base}/api/v1`.replace('//api', '/api')
  if (base.endsWith('/api/v1')) return base
  return `${base}/api/v1`
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE)

class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function getTokens() {
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }
}

export function setTokens(access, refresh) {
  if (access) localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function refreshAccessToken() {
  const { refresh } = getTokens()
  if (!refresh) return null

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })

  if (!res.ok) {
    clearTokens()
    return null
  }

  const data = await res.json()
  setTokens(data.access_token, data.refresh_token)
  return data.access_token
}

export async function apiFetch(path, options = {}) {
  const { skipAuth = false } = options
  const { access } = skipAuth ? { access: null } : getTokens()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (access) headers.Authorization = `Bearer ${access}`

  const fetchOpts = { ...options }
  delete fetchOpts.skipAuth

  let res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers })

  if (!skipAuth && res.status === 401 && access) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers })
    }
  }

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error?.code || 'ERROR', data.error?.message || res.statusText, res.status)
  }
  return data
}

export { ApiError }

/** Authenticated fetch; returns Blob (e.g. QR PNG). */
export async function apiFetchBlob(path, options = {}) {
  const { access } = getTokens()
  const headers = { ...options.headers }
  if (access) headers.Authorization = `Bearer ${access}`

  const fetchOpts = { ...options }
  delete fetchOpts.skipAuth

  let res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers })

  if (res.status === 401 && access) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers })
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(data.error?.code || 'ERROR', data.error?.message || res.statusText, res.status)
  }
  return res.blob()
}

export function qs(params = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}
