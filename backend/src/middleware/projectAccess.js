import { queryOne } from '../db/pool.js'
import { AppError } from './errorHandler.js'

export function isAdmin(role) {
  return role === 'admin'
}

export function isEngineer(role) {
  return role === 'engineer'
}

/** Admin & BQL see all projects; engineer only assigned. */
export function seesAllProjects(role) {
  return role === 'admin' || role === 'bql'
}

export async function assertProjectAccess(userId, role, projectId) {
  if (seesAllProjects(role)) return true

  const row = await queryOne(
    'SELECT id FROM project_users WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
  )
  if (!row) {
    throw new AppError('FORBIDDEN', 'You do not have access to this project', 403)
  }
  return true
}

export async function getAssignedProjectIds(userId) {
  const rows = await queryOne(
    'SELECT GROUP_CONCAT(project_id) AS ids FROM project_users WHERE user_id = ?',
    [userId],
  )
  if (!rows?.ids) return []
  return rows.ids.split(',')
}
