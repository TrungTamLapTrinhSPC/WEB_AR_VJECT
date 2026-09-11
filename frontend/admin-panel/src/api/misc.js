import { apiFetch, qs } from './client.js'

export function fetchElements(params = {}) {
  return apiFetch(`/elements${qs(params)}`)
}

export function fetchElement(guid) {
  return apiFetch(`/elements/${encodeURIComponent(guid)}`)
}

export function fetchSettings() {
  return apiFetch('/settings')
}

export function updateSettings(body) {
  return apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(body) })
}

export function fetchAuditLogs(params = {}) {
  return apiFetch(`/audit-logs${qs(params)}`)
}

export function searchAll(q) {
  return apiFetch(`/search${qs({ q })}`)
}
