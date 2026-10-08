import { apiFetch } from './client.js'

export function fetchProjectAttributeGroups() {
  return apiFetch('/project-attribute-groups')
}

export function fetchProjectAttributeGroup(id) {
  return apiFetch(`/project-attribute-groups/${id}`)
}

export function createProjectAttributeGroup(body) {
  return apiFetch('/project-attribute-groups', { method: 'POST', body: JSON.stringify(body) })
}

export function updateProjectAttributeGroup(id, body) {
  return apiFetch(`/project-attribute-groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteProjectAttributeGroup(id) {
  return apiFetch(`/project-attribute-groups/${id}`, { method: 'DELETE' })
}
