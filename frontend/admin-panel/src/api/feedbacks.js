import { apiFetch, qs } from './client.js'

export function fetchFeedbacks(params = {}) {
  return apiFetch(`/feedbacks${qs(params)}`)
}

export function fetchFeedbackBoard() {
  return apiFetch('/feedbacks/board')
}

export function fetchFeedback(id) {
  return apiFetch(`/feedbacks/${id}`)
}

export function createFeedback(body) {
  return apiFetch('/feedbacks', { method: 'POST', body: JSON.stringify(body) })
}

export function updateFeedback(id, body) {
  return apiFetch(`/feedbacks/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFeedback(id) {
  return apiFetch(`/feedbacks/${id}`, { method: 'DELETE' })
}
