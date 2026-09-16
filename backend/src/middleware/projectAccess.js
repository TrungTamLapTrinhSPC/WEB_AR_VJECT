import { queryOne } from '../db/pool.js'
import { AppError } from './errorHandler.js'

export function isAdmin(role) {
  return role === 'admin'
}

export function isEngineer(role) {
  return role === 'engineer'
}

export function isBql(role) {
  return role === 'bql'
}

/** Admin & BQL see all projects; engineer only assigned (user + group). */
export function seesAllProjects(role) {
  return role === 'admin' || role === 'bql'
}

export async function assertProjectAccess(userId, role, projectId) {
  if (seesAllProjects(role)) return true

  const row = await queryOne(
    `SELECT 1 AS ok FROM (
       SELECT 1 FROM project_users WHERE project_id = ? AND user_id = ?
       UNION
       SELECT 1 FROM project_company_groups pcg
       INNER JOIN users u ON u.company_group_id = pcg.company_group_id AND u.id = ?
       WHERE pcg.project_id = ?
     ) x LIMIT 1`,
    [projectId, userId, userId, projectId],
  )
  if (!row) {
    throw new AppError('FORBIDDEN', 'You do not have access to this project', 403)
  }
  return true
}

/** BQL may assign engineers when admin enabled can_assign_engineers (or always for admin). */
export async function assertCanAssignEngineers(userId, role) {
  if (isAdmin(role)) return true
  if (role !== 'bql') {
    throw new AppError('FORBIDDEN', 'Insufficient permissions', 403)
  }
  const row = await queryOne(
    'SELECT can_assign_engineers FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId],
  )
  if (!row?.can_assign_engineers) {
    throw new AppError('FORBIDDEN', 'BQL chưa được cấp quyền phân công kỹ sư', 403)
  }
  return true
}

export async function getAssignedProjectIds(userId) {
  const rows = await queryOne(
    `SELECT GROUP_CONCAT(DISTINCT pid) AS ids FROM (
       SELECT project_id AS pid FROM project_users WHERE user_id = ?
       UNION
       SELECT pcg.project_id AS pid
       FROM project_company_groups pcg
       INNER JOIN users u ON u.company_group_id = pcg.company_group_id AND u.id = ?
     ) t`,
    [userId, userId],
  )
  if (!rows?.ids) return []
  return rows.ids.split(',')
}
