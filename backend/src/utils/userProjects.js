import { query } from '../db/pool.js'

/** Project IDs via direct assignment + company group. */
export async function getUserProjectIds(userId) {
  const rows = await query(
    `SELECT DISTINCT pid AS project_id FROM (
       SELECT project_id AS pid FROM project_users WHERE user_id = ?
       UNION
       SELECT pcg.project_id AS pid
       FROM project_company_groups pcg
       INNER JOIN users u ON u.company_group_id = pcg.company_group_id AND u.id = ?
     ) t`,
    [userId, userId],
  )
  return rows.map((r) => r.project_id)
}
