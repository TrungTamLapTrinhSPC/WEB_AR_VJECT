import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useI18n } from '../../context/I18nContext'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AdminLayout() {
  const { sidebarOpen, closeSidebar } = useApp()
  const { t } = useI18n()

  return (
    <div className="flex flex-col h-[100dvh] md:grid md:grid-cols-[240px_1fr] md:grid-rows-[auto_1fr]">
      <Header />
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/45 z-[150] md:hidden border-none cursor-default"
          aria-label={t('close_menu')}
          onClick={closeSidebar}
        />
      )}
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 pb-20 md:col-start-2 md:row-start-2 md:px-8 md:py-6 md:pb-[60px] page-enter">
        <Outlet />
      </main>
    </div>
  )
}
