import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { initials, parseJson } from '../utils/helpers'
import { fetchFeedbackBoard, updateFeedback } from '../api/feedbacks'

const TABS = [
  { key: 'pending', labelKey: 'fb_tab_pending', keys: ['open', 'pending'] },
  { key: 'in_progress', labelKey: 'fb_tab_progress', keys: ['in_progress'] },
  { key: 'done', labelKey: 'fb_tab_done', keys: ['resolved', 'closed'] },
]

function mapPrio(p) {
  if (p === 'high' || p === 'hi') return 'hi'
  if (p === 'low') return 'low'
  if (p === 'critical' || p === 'cr') return 'cr'
  return 'med'
}

function emptyBoard() {
  return { open: [], in_progress: [], resolved: [], closed: [], pending: [] }
}

function FeedbackListRow({ f, t, onOpen, onStatusChange, saving }) {
  const images = parseJson(f.images, [])
  return (
    <div className="fb-list-row">
      <button type="button" className="fb-list-main" onClick={() => onOpen(f.id)}>
        <div className="flex justify-between gap-2 items-start">
          <div className="font-semibold text-sm text-left">{f.title || t('fb_no_title')}</div>
          <span className={`prio prio-${mapPrio(f.priority)} shrink-0`}>{(f.priority || 'normal').toUpperCase()}</span>
        </div>
        {f.content ? <div className="text-xs text-text-muted line-clamp-2 mt-1 text-left">{f.content}</div> : null}
        <div className="flex flex-wrap gap-2 text-[11px] text-text-muted mt-2 items-center">
          <span className="avatar w-5 h-5 text-[9px]">{initials(f.user_name)}</span>
          <span>{f.user_name}</span>
          {f.project_name ? <span className="text-primary-dark">{f.project_name}</span> : null}
          <span>📷 {Array.isArray(images) ? images.length : 0}</span>
        </div>
      </button>
      <select
        className="form-select fb-list-status"
        value={f.status === 'pending' ? 'open' : f.status}
        disabled={saving}
        onChange={(e) => onStatusChange(f.id, e.target.value)}
        aria-label={t('fb_field_status')}
      >
        <option value="open">{t('fb_open')}</option>
        <option value="in_progress">{t('fb_inprogress')}</option>
        <option value="resolved">{t('fb_resolved')}</option>
        <option value="closed">{t('fb_closed')}</option>
      </select>
    </div>
  )
}

export default function Feedback() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const [board, setBoard] = useState(emptyBoard())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [savingId, setSavingId] = useState(null)

  const applyFilters = useCallback((data) => {
    let next = {
      open: data.open || [],
      in_progress: data.in_progress || [],
      resolved: data.resolved || [],
      closed: data.closed || [],
      pending: data.pending || [],
    }
    if (search) {
      const q = search.toLowerCase()
      Object.keys(next).forEach((k) => {
        next[k] = next[k].filter((f) =>
          (f.title || '').toLowerCase().includes(q) || (f.user_name || '').toLowerCase().includes(q),
        )
      })
    }
    if (priority) {
      Object.keys(next).forEach((k) => {
        next[k] = next[k].filter((f) => f.priority === priority)
      })
    }
    return next
  }, [search, priority])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFeedbackBoard()
      setBoard(applyFilters(data))
    } catch {
      setBoard(emptyBoard())
    } finally {
      setLoading(false)
    }
  }, [applyFilters])

  useEffect(() => { load() }, [load, dataVersion])

  const tabItems = useMemo(() => {
    const tab = TABS.find((x) => x.key === activeTab) || TABS[0]
    return tab.keys.flatMap((k) => board[k] || [])
  }, [board, activeTab])

  const tabCounts = useMemo(() => ({
    pending: [...(board.open || []), ...(board.pending || [])].length,
    in_progress: (board.in_progress || []).length,
    done: [...(board.resolved || []), ...(board.closed || [])].length,
  }), [board])

  const openDetail = (id) => openModal('feedback', { id })

  const handleStatusChange = async (id, status) => {
    setSavingId(id)
    try {
      await updateFeedback(id, { status })
      refreshData()
      toast('success', t('saved'))
      load()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('fb_title')}</div>
          <div className="page-sub">{t('fb_sub')}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={load}><Icon name="refresh" size={14} /> {t('refresh')}</button>
          <button type="button" className="btn btn-p" onClick={() => openModal('feedback-new')}>
            <Icon name="plus" size={14} /> {t('fb_new')}
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('fb_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">{t('fb_all_prio')}</option>
          <option value="high">{t('prio_high')}</option>
          <option value="normal">{t('prio_medium')}</option>
          <option value="low">{t('prio_low')}</option>
        </select>
      </div>
      <div className="fb-tabs mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`fb-tab${activeTab === tab.key ? ' fb-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
            <span className="fb-tab-count">{tabCounts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('loading')}</div>
      ) : (
        <div className="fb-list-section-body card p-2">
          {tabItems.length === 0 ? (
            <div className="text-xs text-text-muted py-8 px-2 text-center">{t('empty_feedback')}</div>
          ) : (
            tabItems.map((f) => (
              <FeedbackListRow
                key={f.id}
                f={f}
                t={t}
                onOpen={openDetail}
                onStatusChange={handleStatusChange}
                saving={savingId === f.id}
              />
            ))
          )}
        </div>
      )}
    </>
  )
}
