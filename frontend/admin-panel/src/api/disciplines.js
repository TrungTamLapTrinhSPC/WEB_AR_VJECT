import { apiFetch } from './client.js'

export function fetchDisciplines() {
  return apiFetch('/disciplines')
}
