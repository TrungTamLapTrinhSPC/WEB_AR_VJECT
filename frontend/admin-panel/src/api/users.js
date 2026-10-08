import { apiFetch, qs } from './client.js'

export function fetchUsers(params = {}) {
  return apiFetch(`/users${qs(params)}`)
}

export function fetchUserStats() {
  return apiFetch('/users/stats')
}

export function fetchUser(id) {
  return apiFetch(`/users/${id}`)
}

export function createUser(body) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(body) })
}

export function updateUser(id, body) {
  return apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteUser(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' })
}

export function setUserPassword(id, password) {
  return apiFetch(`/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) })
}
