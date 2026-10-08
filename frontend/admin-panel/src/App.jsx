import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { I18nProvider } from './context/I18nContext'
import { AuthProvider } from './context/AuthContext'
import { AppProvider, useApp } from './context/AppContext'
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AuthLayout from './components/layout/AuthLayout'
import AdminLayout from './components/layout/AdminLayout'
import ToastContainer from './components/ToastContainer'
import Modals from './components/Modals'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Bim from './pages/Bim'
import Qr from './pages/Qr'
import Gps from './pages/Gps'
import Elements from './pages/Elements'
import Feedback from './pages/Feedback'
import Users from './pages/Users'
import CompanyGroups from './pages/CompanyGroups'
import ProjectAttributeGroups from './pages/ProjectAttributeGroups'
import Settings from './pages/Settings'
import Audit from './pages/Audit'
import { getBasename } from './utils/basePath'

function AppShell() {
  const { toasts } = useApp()

  return (
    <>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="bim" element={<Bim />} />
            <Route path="qr" element={<Qr />} />
            <Route path="gps" element={<Gps />} />
            <Route path="elements" element={<Elements />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="groups" element={<AdminRoute><CompanyGroups /></AdminRoute>} />
            <Route path="attribute-groups" element={<AdminRoute><ProjectAttributeGroups /></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="audit" element={<AdminRoute><Audit /></AdminRoute>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Modals />
      <ToastContainer toasts={toasts} />
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter basename={getBasename()}>
            <AppShell />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </I18nProvider>
  )
}
