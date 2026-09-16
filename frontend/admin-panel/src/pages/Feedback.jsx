import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { initials, parseJson } from '../utils/helpers'
import { fetchFeedbackBoard } from '../api/feedbacks'

const COLS = {
  open: { c: '#EF4444', key: 'open' },
  in_progress: { c: '#F59E0B', key: 'inprogress' },
  resolved: { c: '#22C55E', key: 'resolved' },
  closed: { c: '#9CA3AF', key: 'closed' },
}

function mapPrio(p) {
  if (p === 'high' || p === 'hi') return 'hi'
  if (p === 'low') return 'low'
  if (p === 'critical' || p === 'cr') return 'cr'
  return 'med'
}

export default function Feedback() {
  const { t } = useI18n()
  const { openModal, dataVersion } = useApp()
  const [board, setBoard] = useState({ open: [], in_progress: [], resolved: [], closed: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFeedbackBoard()
      let next = {
        open: data.open || [],
        in_progress: data.in_progress || [],
        resolved: data.resolved || [],
        closed: data.closed || [],
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
      setBoard(next)
    } catch {
      setBoard({ open: [], in_progress: [], resolved: [], closed: [] })
    } finally {
      setLoading(false)
    }
  }, [search, priority])

  useEffect(() => { load() }, [load, dataVersion])

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
      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('loading')}</div>
      ) : (
        <div className="board">
          {Object.entries(COLS).map(([k, { c, key }]) => (
            <div key={k} className="col">
              <div className="col-hd">
                <div className="col-title" style={{ color: c }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: c }} />
                  {t(`fb_${key}`)}
                </div>
                <div className="col-count">{board[k]?.length || 0}</div>
              </div>
              {(board[k] || []).map((f) => {
                const images = parseJson(f.images, [])
                return (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    className="col-card"
                    onClick={() => openModal('feedback', { id: f.id })}
                    onKeyDown={(e) => e.key === 'Enter' && openModal('feedback', { id: f.id })}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-text-muted font-mono">{String(f.id).slice(0, 8)}</span>
                      <span className={`prio prio-${mapPrio(f.priority)}`}>{(f.priority || 'normal').toUpperCase()}</span>
                    </div>
                    <div className="text-[13px] font-semibold mb-1.5 leading-snug">{f.title || t('fb_no_title')}</div>
                    {f.content ? (
                      <div className="text-[11px] text-text-muted line-clamp-2 mb-1">{f.content}</div>
                    ) : null}
                    {f.project_name ? (
                      <div className="text-[11px] text-primary-dark font-medium mb-1">{f.project_name}</div>
                    ) : null}
                    <div className="flex gap-2 text-[11px] text-text-muted items-center mt-2 pt-2 border-t border-dashed border-border flex-wrap">
                      <div className="avatar w-5 h-5 text-[9px]">{initials(f.user_name)}</div>
                      <span>{f.user_name}</span>
                      <span className="chip chip-gray text-[10px] py-0">{f.location_type || 'gps'}</span>
                      <span className="ml-auto">📷 {Array.isArray(images) ? images.length : 0}</span>
                    </div>
                  </div>
                )
              })}
              {(board[k] || []).length === 0 && (
                <div className="text-xs text-text-muted text-center py-5">{t('fb_empty')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
