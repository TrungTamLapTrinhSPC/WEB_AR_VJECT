import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCompanyGroups } from '../api/companyGroups'
import Icon from './Icon'

/** Chọn nhóm công ty (user form) — combobox có tìm kiếm. */
export default function CompanyGroupField({ value, onChange, selectedName, allowCreate, onCreateClick, t }) {
  const boxRef = useRef(null)
  const [groups, setGroups] = useState([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchCompanyGroups()
      .then((r) => setGroups(r.data || []))
      .catch(() => setGroups([]))
  }, [])

  useEffect(() => {
    if (open) return
    const sel = groups.find((g) => g.id === value)
    if (sel) setQuery(sel.name)
    else if (value && selectedName) setQuery(selectedName)
    else if (!value) setQuery('')
  }, [value, groups, open, selectedName])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups
    return list
  }, [groups, query])

  return (
    <div className="form-row" ref={boxRef}>
      <div className="flex items-center justify-between gap-2">
        <label className="form-label mb-0">{t('user_company_group')}</label>
        {allowCreate && onCreateClick && (
          <button type="button" className="text-xs font-semibold text-primary-dark bg-transparent border-0 cursor-pointer" onClick={onCreateClick}>
            + {t('group_create_short')}
          </button>
        )}
      </div>
      <div className="relative mt-1">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
        <input
          type="text"
          className="form-input w-full pl-[38px]"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange('', '')
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('group_search')}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon text-text-muted"
            onClick={() => {
              onChange('', '')
              setQuery('')
            }}
            aria-label={t('all')}
          >
            <Icon name="x" size={14} />
          </button>
        )}
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-border rounded-lg shadow-lg max-h-[220px] overflow-auto z-[300]">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] text-text-muted hover:bg-[#F9FAFB] border-none bg-transparent cursor-pointer"
              onClick={() => {
                onChange('', '')
                setQuery('')
                setOpen(false)
              }}
            >
              {t('all')} — {t('group_no_group')}
            </button>
            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`w-full text-left px-3 py-2.5 border-none bg-transparent cursor-pointer hover:bg-primary-light flex items-center gap-2 ${
                  value === g.id ? 'bg-primary-light' : ''
                }`}
                onClick={() => {
                  onChange(g.id, g.name)
                  setQuery(g.name)
                  setOpen(false)
                }}
              >
                <Icon name="building" size={16} className="text-primary-dark shrink-0" />
                <span className="text-[13px] font-medium">{g.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-text-muted">{t('search_no_results')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
