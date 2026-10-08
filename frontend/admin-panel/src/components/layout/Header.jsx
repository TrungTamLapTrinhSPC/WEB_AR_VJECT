import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useI18n } from '../../context/I18nContext'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import Icon from '../Icon'
import { initials, formatDateTime } from '../../utils/helpers'
import { useApp } from '../../context/AppContext'
import { searchAll } from '../../api/misc'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications'
import LangSwitcher from '../LangSwitcher'
import CompanyLogo from '../CompanyLogo'

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
  const { toast, openModal, toggleSidebar, dataVersion } = useApp()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const notifRef = useRef(null)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (user?.language) {
      setLang(user.language)
    }
  }, [user?.id, user?.language, setLang])

  useEffect(() => {
    if (!user) return
    fetchUnreadNotificationCount()
      .then((r) => setUnreadCount(r.count || 0))
      .catch(() => setUnreadCount(0))
  }, [user, dataVersion])

  useEffect(() => {
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const loadNotifications = async () => {
    setNotifLoading(true)
    try {
      const res = await fetchNotifications({ limit: 20 })
      setNotifItems(res.data || [])
    } catch (err) {
      toast('err', err.message)
      setNotifItems([])
    } finally {
      setNotifLoading(false)
    }
  }

  const toggleNotifications = async () => {
    const next = !notifOpen
    setNotifOpen(next)
    if (next) await loadNotifications()
  }

  const openNotification = async (n) => {
    try {
      if (!n.read_at) {
        await markNotificationRead(n.id)
        setUnreadCount((c) => Math.max(0, c - 1))
      }
    } catch { /* ignore */ }
    setNotifOpen(false)
    const path = n.link_path || ''
    if (path.includes('feedback')) {
      const m = path.match(/open=([^&]+)/)
      if (m) openModal('feedback', { id: m[1] })
      else navigate('/feedback')
      return
    }
    if (path.includes('projects')) navigate('/projects')
    else navigate('/')
  }

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setUnreadCount(0)
      setNotifItems((items) => items.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    } catch (err) {
      toast('err', err.message)
    }
  }

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
      <div className="flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-3 md:gap-5 min-h-[60px] md:min-h-[68px]">
        <button
          type="button"
          className="btn-icon md:hidden shrink-0"
          onClick={toggleSidebar}
          aria-label={t('open_menu')}
        >
          <Icon name="menu" size={20} />
        </button>

        <Link to="/" className="flex items-center min-w-0 max-w-[min(100%,300px)] sm:max-w-[380px] md:max-w-[480px] no-underline shrink-0" title={t('brand_sub')}>
          <CompanyLogo preset="header" />
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

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              className="hidden sm:flex bg-transparent border-none p-2 rounded-lg cursor-pointer text-text-muted relative items-center justify-center transition-all hover:bg-primary-light hover:text-primary-dark"
              onClick={toggleNotifications}
              aria-label={t('notif_title')}
            >
              <Icon name="bell" size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[min(100vw-24px,360px)] bg-white border border-border rounded-xl shadow-xl z-[220] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
                  <span className="font-semibold text-sm">{t('notif_title')}</span>
                  <button type="button" className="text-xs text-primary-dark bg-transparent border-none cursor-pointer" onClick={markAllRead}>
                    {t('notif_mark_all')}
                  </button>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  {notifLoading ? (
                    <div className="p-4 text-xs text-text-muted text-center">{t('loading')}</div>
                  ) : notifItems.length === 0 ? (
                    <div className="p-4 text-xs text-text-muted text-center">{t('notif_empty')}</div>
                  ) : (
                    notifItems.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`w-full text-left px-3 py-2.5 border-none border-b border-border-light cursor-pointer hover:bg-primary-light ${n.read_at ? 'bg-white' : 'bg-primary-light/40'}`}
                        onClick={() => openNotification(n)}
                      >
                        <div className="font-semibold text-[13px] line-clamp-2">{n.title}</div>
                        {n.body ? <div className="text-xs text-text-muted mt-1 line-clamp-2">{n.body}</div> : null}
                        <div className="text-[10px] text-text-muted mt-1">{formatDateTime(n.created_at)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
