import { Link, Outlet } from 'react-router-dom'
import { useI18n } from '../../context/I18nContext'
import LangSwitcher from '../LangSwitcher'

export default function AuthLayout() {
  const { t } = useI18n()

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px] flex justify-end mb-3">
        <LangSwitcher />
      </div>
      <Link to="/" className="flex items-center gap-2.5 mb-8 no-underline text-text">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-[9px] flex items-center justify-center text-white font-black text-lg">
          R
        </div>
        <div>
          <div className="font-bold text-lg tracking-tight">PA3 Admin</div>
          <div className="text-xs text-text-muted">{t('brand_sub')}</div>
        </div>
      </Link>
      <div className="w-full max-w-[420px] bg-card border border-border rounded-xl p-5 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
        <Outlet />
      </div>
    </div>
  )
}
