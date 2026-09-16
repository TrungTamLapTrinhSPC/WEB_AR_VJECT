import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'

/**
 * Gán nhóm công ty cho dự án (UI tương tự thêm thành viên).
 * assigned: [{ company_group_id, name }] hoặc [{ id, name }]
 */
export default function CompanyGroupAssign({
  assigned = [],
  allGroups = [],
  onAssign,
  onRemove,
  canEdit = false,
  canCreate = false,
  onCreateClick,
  t,
}) {
  const boxRef = useRef(null)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pickId, setPickId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const assignedIds = useMemo(
    () => new Set(assigned.map((g) => g.company_group_id ?? g.id)),
    [assigned],
  )

  const available = useMemo(
    () => allGroups.filter((g) => !assignedIds.has(g.id)),
    [allGroups, assignedIds],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available
    return available.filter((g) => g.name.toLowerCase().includes(q))
  }, [available, query])

  const picked = useMemo(
    () => allGroups.find((g) => g.id === pickId) || filtered.find((g) => g.id === pickId),
    [allGroups, filtered, pickId],
  )

  useEffect(() => {
    if (!addOpen) return undefined
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [addOpen])

  const handleAssign = async () => {
    if (!pickId || saving) return
    setSaving(true)
    try {
      await onAssign(pickId)
      setPickId('')
      setQuery('')
      setPickerOpen(false)
      setAddOpen(false)
    } catch {
      /* parent shows toast */
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-[#F9FAFB] p-3 mb-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="building" size={18} className="text-primary-dark shrink-0" />
            <h3 className="text-sm font-bold m-0">{t('prj_groups_title')}</h3>
            <span className="chip chip-blue text-[11px]">{assigned.length}</span>
          </div>
          <p className="text-xs text-text-muted mt-1 mb-0">{t('group_assign_hint')}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn-icon shrink-0 text-primary-dark hover:bg-white"
            onClick={() => {
              setAddOpen((v) => {
                const next = !v
                if (next) {
                  setQuery('')
                  setPickId('')
                  setPickerOpen(true)
                }
                return next
              })
            }}
            aria-label={t('prj_add_group')}
            title={t('prj_add_group')}
          >
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>

      {assigned.length === 0 && !addOpen && (
        <div className="text-sm text-text-muted py-2 px-1">{t('group_none_assigned')}</div>
      )}

      <ul className="list-none p-0 m-0 space-y-1.5">
        {assigned.map((g) => {
          const id = g.company_group_id ?? g.id
          return (
            <li
              key={id}
              className="flex items-center gap-2.5 py-2 px-2.5 bg-white border border-border rounded-lg"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-light text-primary-dark flex items-center justify-center shrink-0">
                <Icon name="building" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] truncate">{g.name}</div>
                <div className="text-[11px] text-text-muted font-mono truncate">{String(id).slice(0, 8)}…</div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="btn-icon text-danger shrink-0"
                  onClick={() => onRemove(id)}
                  aria-label={t('remove')}
                  title={t('remove')}
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {addOpen && canEdit && (
        <div className="mt-3 pt-3 border-t border-border-light" ref={boxRef}>
          <label className="form-label">{t('prj_pick_group')}</label>
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
            <input
              type="text"
              className="form-input w-full pl-[38px]"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPickId('')
                setPickerOpen(true)
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder={t('group_search')}
              disabled={saving}
              autoComplete="off"
            />
          </div>
          {picked && (
            <div className="text-xs text-text-muted mt-1.5 truncate">
              {t('add')}: <span className="font-semibold text-text">{picked.name}</span>
            </div>
          )}
          {pickerOpen && (
            <div className="relative">
              <div className="absolute left-0 right-0 top-1 bg-white border border-border rounded-lg shadow-lg max-h-[200px] overflow-auto z-[300]">
                {filtered.length === 0 && (
                  <div className="px-3 py-3 text-xs text-text-muted">
                    {query.trim() ? t('search_no_results') : t('group_no_available')}
                  </div>
                )}
                {filtered.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`w-full text-left px-3 py-2.5 border-none bg-transparent cursor-pointer hover:bg-primary-light flex items-center gap-2.5 ${
                      pickId === g.id ? 'bg-primary-light' : ''
                    }`}
                    onClick={() => {
                      setPickId(g.id)
                      setQuery(g.name)
                      setPickerOpen(false)
                    }}
                  >
                    <Icon name="building" size={16} className="text-primary-dark shrink-0" />
                    <span className="text-[13px] font-medium truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <button type="button" className="btn" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="button" className="btn btn-p" disabled={saving || !pickId} onClick={handleAssign}>
              {saving ? '...' : t('prj_add_group')}
            </button>
            {canCreate && onCreateClick && (
              <button type="button" className="btn text-primary-dark ml-auto" onClick={onCreateClick}>
                <Icon name="plus" size={14} /> {t('group_create_short')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
