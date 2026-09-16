import { useAuth } from '../context/AuthContext'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role

  return {
    isAdmin: role === 'admin',
    isEngineer: role === 'engineer',
    isBql: role === 'bql',
    canManageProjects: role === 'admin',
    /** Admin hoặc BQL được admin bật can_assign_engineers */
    canManageProjectTeam: role === 'admin' || (role === 'bql' && !!user?.can_assign_engineers),
    canManageUsers: role === 'admin',
    canViewSettings: role === 'admin',
    canViewAudit: role === 'admin',
    assignedProjectIds: user?.project_ids ?? [],
    canAccessProject: (projectId) => {
      if (role === 'admin' || role === 'bql') return true
      if (role === 'engineer') {
        return (user?.project_ids ?? []).includes(projectId)
      }
      return false
    },
    roleLabelKey: role === 'admin' ? 'role_admin'
      : role === 'engineer' ? 'user_role_eng'
      : role === 'bql' ? 'user_role_bql'
      : 'role_admin',
  }
}
