import { Link, Outlet } from 'react-router-dom'
import { useI18n } from '../../context/I18nContext'
import LangSwitcher from '../LangSwitcher'
import CompanyLogo from '../CompanyLogo'

export default function AuthLayout() {
  const { t } = useI18n()

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px] flex justify-end mb-3">
        <LangSwitcher />
      </div>
      <Link to="/" className="flex flex-col items-center gap-2 mb-8 no-underline text-text w-full max-w-[360px]">
        <CompanyLogo className="h-12 sm:h-14 object-center w-full max-w-[320px]" />
        <p className="text-xs text-text-muted text-center m-0">{t('brand_sub')}</p>
      </Link>
      <div className="w-full max-w-[420px] bg-card border border-border rounded-xl p-5 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
        <Outlet />
      </div>
    </div>
  )
}
