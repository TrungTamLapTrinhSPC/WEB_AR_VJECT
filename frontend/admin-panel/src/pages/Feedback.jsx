import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { initials, parseJson } from '../utils/helpers'
import { fetchFeedbackBoard, updateFeedback } from '../api/feedbacks'

const COLUMN_ORDER = ['open', 'in_progress', 'resolved', 'closed']

const COLS = {
  open: { c: '#EF4444', key: 'open', status: 'open' },
  in_progress: { c: '#F59E0B', key: 'inprogress', status: 'in_progress' },
  resolved: { c: '#22C55E', key: 'resolved', status: 'resolved' },
  closed: { c: '#9CA3AF', key: 'closed', status: 'closed' },
}

function mapPrio(p) {
  if (p === 'high' || p === 'hi') return 'hi'
  if (p === 'low') return 'low'
  if (p === 'critical' || p === 'cr') return 'cr'
  return 'med'
}

function emptyBoard() {
  return { open: [], in_progress: [], resolved: [], closed: [] }
}

function moveBetweenColumns(board, fromCol, toCol, id) {
  if (fromCol === toCol) return board
  const item = board[fromCol]?.find((f) => f.id === id)
  if (!item) return board
  const status = COLS[toCol].status
  return {
    ...board,
    [fromCol]: board[fromCol].filter((f) => f.id !== id),
    [toCol]: [{ ...item, status }, ...board[toCol]],
  }
}

function FeedbackCard({ f, t, onOpen, onDragStart, onDragEnd, dragging }) {
  const images = parseJson(f.images, [])
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, f.id)}
      onDragEnd={onDragEnd}
      role="button"
      tabIndex={0}
      className={`col-card col-card-draggable${dragging ? ' col-card-dragging' : ''}`}
      onClick={() => onOpen(f.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(f.id)}
    >
      <div className="flex justify-between items-center mb-2 gap-2">
        <span className="text-xs text-text-muted font-mono shrink-0">{String(f.id).slice(0, 8)}</span>
        <span className="col-card-grip text-text-muted" title={t('fb_drag_hint')} aria-hidden>
          ⋮⋮
        </span>
        <span className={`prio prio-${mapPrio(f.priority)} shrink-0`}>{(f.priority || 'normal').toUpperCase()}</span>
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
}

export default function Feedback() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const [board, setBoard] = useState(emptyBoard())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [dropCol, setDropCol] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const dragPayload = useRef(null)
  const suppressClick = useRef(false)

  const applyFilters = useCallback((data) => {
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

  const handleDragStart = (e, colKey, id) => {
    dragPayload.current = { fromCol: colKey, id }
    setDraggingId(id)
    suppressClick.current = true
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 24, 20)
    }
  }

  const handleCardDragStart = (e, id) => {
    const colKey = COLUMN_ORDER.find((k) => board[k]?.some((f) => f.id === id))
    if (colKey) handleDragStart(e, colKey, id)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDropCol(null)
    dragPayload.current = null
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  const handleDragOverColumn = (e, colKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropCol(colKey)
  }

  const handleDropColumn = async (e, toCol) => {
    e.preventDefault()
    setDropCol(null)
    const payload = dragPayload.current
    handleDragEnd()
    if (!payload) return
    const { fromCol, id } = payload
    if (fromCol === toCol) return

    const prev = board
    const next = moveBetweenColumns(board, fromCol, toCol, id)
    setBoard(next)
    setSavingId(id)

    try {
      await updateFeedback(id, { status: COLS[toCol].status })
      refreshData()
      toast('success', t('saved'))
    } catch (err) {
      setBoard(prev)
      toast('err', err.message)
      load()
    } finally {
      setSavingId(null)
    }
  }

  const openDetail = (id) => {
    if (suppressClick.current) return
    openModal('feedback', { id })
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
        <span className="text-xs text-text-muted hidden sm:inline">{t('fb_drag_hint')}</span>
      </div>
      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('loading')}</div>
      ) : (
        <div className="board board-kanban">
          {COLUMN_ORDER.map((k) => {
            const { c, key } = COLS[k]
            const isDrop = dropCol === k
            return (
              <div
                key={k}
                className={`col col-kanban${isDrop ? ' col-kanban-drop' : ''}`}
                onDragOver={(e) => handleDragOverColumn(e, k)}
                onDragLeave={() => setDropCol((prev) => (prev === k ? null : prev))}
                onDrop={(e) => handleDropColumn(e, k)}
              >
                <div className="col-hd">
                  <div className="col-title" style={{ color: c }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: c }} />
                    {t(`fb_${key}`)}
                  </div>
                  <div className="col-count">{board[k]?.length || 0}</div>
                </div>
                <div className="col-body min-h-[120px]">
                  {(board[k] || []).map((f) => (
                    <FeedbackCard
                      key={f.id}
                      f={f}
                      t={t}
                      onOpen={openDetail}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleDragEnd}
                      dragging={draggingId === f.id || savingId === f.id}
                    />
                  ))}
                  {(board[k] || []).length === 0 && (
                    <div className="col-empty">{t('fb_drop_here')}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
