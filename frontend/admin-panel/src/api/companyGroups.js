import { apiFetch } from './client.js'

export function fetchCompanyGroups() {
  return apiFetch('/company-groups')
}

export function fetchCompanyGroup(id) {
  return apiFetch(`/company-groups/${id}`)
}

export function createCompanyGroup(name) {
  return apiFetch('/company-groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateCompanyGroup(id, body) {
  return apiFetch(`/company-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteCompanyGroup(id) {
  return apiFetch(`/company-groups/${id}`, { method: 'DELETE' })
}
