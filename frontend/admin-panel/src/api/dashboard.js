import { apiFetch } from './client.js'

export function fetchDashboardStats() {
  return apiFetch('/dashboard/stats')
}

export function fetchRecentFeedbacks(limit = 5) {
  return apiFetch(`/dashboard/recent-feedbacks?limit=${limit}`)
}

export function fetchRecentBim(limit = 4) {
  return apiFetch(`/dashboard/recent-bim?limit=${limit}`)
}
