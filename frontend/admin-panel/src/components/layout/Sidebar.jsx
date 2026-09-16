import { NavLink } from 'react-router-dom'
import Icon from '../Icon'
import { useI18n } from '../../context/I18nContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useApp } from '../../context/AppContext'
import CompanyLogo from '../CompanyLogo'
import { Link } from 'react-router-dom'

const NAV = [
  { section: 'nav_main', items: [
    { to: '/', icon: 'home', label: 'nav_dashboard', end: true },
    { to: '/projects', icon: 'building', label: 'nav_projects' },
  ]},
  { section: 'nav_content', items: [
    { to: '/bim', icon: 'cube', label: 'nav_bim' },
    { to: '/qr', icon: 'qr', label: 'nav_qr' },
    { to: '/gps', icon: 'map-pin', label: 'nav_gps' },
    { to: '/elements', icon: 'wrench', label: 'nav_elements' },
  ]},
  { section: 'nav_ops', items: [
    { to: '/feedback', icon: 'chat', label: 'nav_feedback' },
    { to: '/groups', icon: 'building', label: 'nav_groups', adminOnly: true },
    { to: '/users', icon: 'users', label: 'nav_users', adminOnly: true },
  ]},
  { section: 'nav_system', items: [
    { to: '/settings', icon: 'cog', label: 'nav_settings', adminOnly: true },
    { to: '/audit', icon: 'history', label: 'nav_audit', adminOnly: true },
  ]},
]

export default function Sidebar() {
  const { t } = useI18n()
  const { isAdmin } = usePermissions()
  const { sidebarOpen, closeSidebar } = useApp()

  const handleNav = () => {
    if (window.matchMedia('(max-width: 767px)').matches) closeSidebar()
  }

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-[160] w-[260px] max-w-[85vw] bg-card border-r border-border overflow-y-auto py-4 transition-transform duration-200 ease-out md:col-start-1 md:row-start-2 md:w-auto md:max-w-none ${
        sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0 md:shadow-none'
      }`}
    >
      <div className="flex items-center justify-between px-5 pb-3 mb-1 border-b border-border md:hidden">
        <Link to="/" onClick={handleNav} className="min-w-0 flex-1 no-underline">
          <CompanyLogo height={28} className="max-w-[200px]" />
        </Link>
        <button type="button" className="btn-icon shrink-0" onClick={closeSidebar} aria-label={t('close_menu')}>
          <Icon name="x" size={16} />
        </button>
      </div>
      {NAV.map(({ section, items }) => {
        const visible = items.filter((item) => !item.adminOnly || isAdmin)
        if (!visible.length) return null
        return (
          <div key={section}>
            <div className="px-5 pt-3.5 pb-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
              {t(section)}
            </div>
            {visible.map(({ to, icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={handleNav}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-text no-underline text-[13px] font-medium border-l-[3px] transition-all ${
                    isActive
                      ? 'bg-primary-light text-primary-dark border-l-primary font-semibold'
                      : 'border-l-transparent hover:bg-border-light hover:text-primary-dark'
                  }`
                }
              >
                <Icon name={icon} size={18} className="shrink-0" />
                <span>{t(label)}</span>
              </NavLink>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
