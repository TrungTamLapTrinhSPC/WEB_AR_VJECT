import { apiFetch } from './client.js'

export function fetchBackupInfo() {
  return apiFetch('/system/backup/info')
}
