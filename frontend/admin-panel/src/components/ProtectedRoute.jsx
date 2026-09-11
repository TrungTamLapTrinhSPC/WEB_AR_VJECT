import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'

function LoadingScreen() {
  const { t } = useI18n()
  return (
    <div className="h-screen flex items-center justify-center bg-bg text-text-muted">
      {t('loading')}
    </div>
  )
}

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
