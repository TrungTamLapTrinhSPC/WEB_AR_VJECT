import { Navigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'

export default function AdminRoute({ children }) {
  const { isAdmin } = usePermissions()
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
