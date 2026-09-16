import { apiFetch } from './client.js'

export function fetchProjects(params = {}) {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.status) qs.set('status', params.status)
  if (params.search) qs.set('search', params.search)
  const query = qs.toString()
  return apiFetch(`/projects${query ? `?${query}` : ''}`)
}

export function fetchProject(id) {
  return apiFetch(`/projects/${id}`)
}

export function fetchProjectStats(id) {
  return apiFetch(`/projects/${id}/stats`)
}

export function fetchProjectTeam(id) {
  return apiFetch(`/projects/${id}/team`)
}

export function createProject(body) {
  return apiFetch('/projects', { method: 'POST', body: JSON.stringify(body) })
}

export function updateProject(id, body) {
  return apiFetch(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteProject(id) {
  return apiFetch(`/projects/${id}`, { method: 'DELETE' })
}

export function assignEngineer(projectId, userId) {
  return apiFetch(`/projects/${projectId}/team`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export function removeTeamMember(projectId, userId) {
  return apiFetch(`/projects/${projectId}/team/${userId}`, { method: 'DELETE' })
}

export function assignProjectGroup(projectId, companyGroupId) {
  return apiFetch(`/projects/${projectId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ company_group_id: companyGroupId }),
  })
}

export function removeProjectGroup(projectId, companyGroupId) {
  return apiFetch(`/projects/${projectId}/groups/${companyGroupId}`, { method: 'DELETE' })
}
