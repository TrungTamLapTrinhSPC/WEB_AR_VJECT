import { apiFetch, qs } from './client.js'

export function fetchNotifications(params = {}) {
  return apiFetch(`/notifications${qs(params)}`)
}

export function fetchUnreadNotificationCount() {
  return apiFetch('/notifications/unread-count')
}

export function markNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return apiFetch('/notifications/read-all', { method: 'POST' })
}
