import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useI18n } from '../../context/I18nContext'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import Icon from '../Icon'
import { initials } from '../../utils/helpers'
import { useApp } from '../../context/AppContext'
import { searchAll } from '../../api/misc'
import LangSwitcher from '../LangSwitcher'

const TYPE_ROUTE = {
  project: '/',
  bim: '/bim',
  qr: '/qr',
  feedback: '/feedback',
  user: '/users',
}

const TYPE_MODAL = {
  project: 'project',
  bim: 'bim-detail',
  feedback: 'feedback',
}

export default function Header() {
  const { setLang, t } = useI18n()
  const { user } = useAuth()
  const { roleLabelKey } = usePermissions()
  const { toast, openModal, toggleSidebar } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef(null)
  const timerRef = useRef(null)

  // Chỉ sync khi user đăng nhập / profile đổi — không reset khi user bấm VI|EN|JA
  useEffect(() => {
    if (user?.language) {
      setLang(user.language)
    }
  }, [user?.id, user?.language, setLang])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchAll(q.trim())
        setResults(res.data || [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [q])

  const handlePick = (item) => {
    setOpen(false)
    setSearchOpen(false)
    setQ('')
    const modal = TYPE_MODAL[item.type]
    if (modal) {
      openModal(modal, { id: item.id })
      return
    }
    navigate(TYPE_ROUTE[item.type] || '/')
  }

  const searchBox = (
    <div className="relative w-full" ref={boxRef}>
      <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
      <input
        type="text"
        placeholder={t('h_search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full py-2.5 px-3.5 pl-[38px] border border-border rounded-lg text-[13px] bg-[#F9FAFB] transition-all focus:outline-none focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/10"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-border rounded-lg shadow-lg max-h-[320px] overflow-auto z-[200]">
          {searching && <div className="px-3 py-2 text-xs text-text-muted">{t('search_loading')}</div>}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-muted">{t('search_no_results')}</div>
          )}
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              className="w-full text-left px-3 py-2.5 border-none bg-transparent cursor-pointer hover:bg-primary-light flex items-center gap-2"
              onClick={() => handlePick(item)}
            >
              <span className="chip chip-gray text-[10px] uppercase">{item.type}</span>
              <span className="text-[13px] font-medium truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <header className="md:col-span-2 md:row-start-1 bg-card border-b border-border flex flex-col z-[100] shadow-[0_1px_3px_rgba(0,0,0,.06)] shrink-0">
      <div className="flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-3 md:gap-5 min-h-[56px] md:min-h-[60px]">
        <button
          type="button"
          className="btn-icon md:hidden shrink-0"
          onClick={toggleSidebar}
          aria-label={t('open_menu')}
        >
          <Icon name="menu" size={20} />
        </button>

        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0 no-underline text-text shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-primary to-primary-dark rounded-[9px] flex items-center justify-center text-white font-black text-sm sm:text-base">
            R
          </div>
          <div className="block min-w-0">
            <div className="font-bold text-sm sm:text-[15px] tracking-tight truncate">PA3 Admin</div>
            <div className="text-[10px] sm:text-[11px] text-text-muted font-medium hidden sm:block">{t('brand_sub')}</div>
          </div>
        </Link>

        <div className="hidden lg:flex flex-1 max-w-[520px]">
          {searchBox}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            className="btn-icon lg:hidden"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={t('search')}
          >
            <Icon name="search" size={20} />
          </button>

          <LangSwitcher />

          <button
            type="button"
            className="hidden sm:flex bg-transparent border-none p-2 rounded-lg cursor-pointer text-text-muted relative items-center justify-center transition-all hover:bg-primary-light hover:text-primary-dark"
            onClick={() => toast('info', t('coming_soon'))}
          >
            <Icon name="bell" size={20} />
          </button>

          <div
            className="flex items-center gap-2 sm:gap-2.5 py-1 sm:py-1.5 pl-1 sm:pl-1.5 pr-2 sm:pr-3 rounded-3xl cursor-pointer transition-colors hover:bg-border-light"
            onClick={() => openModal('profile')}
            onKeyDown={(e) => e.key === 'Enter' && openModal('profile')}
            role="button"
            tabIndex={0}
          >
            <div className="avatar">{user ? initials(user.full_name) : '?'}</div>
            <div className="hidden md:block">
              <div className="text-[13px] font-semibold max-w-[120px] truncate">{user?.full_name || '—'}</div>
              <div className="text-[11px] text-text-muted">{t(roleLabelKey)}</div>
            </div>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="lg:hidden px-3 pb-3 border-t border-border-light pt-2">
          {searchBox}
        </div>
      )}
    </header>
  )
}
