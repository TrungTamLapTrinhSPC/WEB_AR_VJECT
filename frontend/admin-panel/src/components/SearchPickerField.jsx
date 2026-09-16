import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'

/**
 * Combobox: ô search + dropdown chọn (dự án, BIM, …).
 * options: [{ id, label, hint? }]
 */
export default function SearchPickerField({
  label,
  placeholder,
  noneLabel,
  value,
  selectedLabel,
  options = [],
  onChange,
  onQueryChange,
  disabled = false,
  loading = false,
  emptyMessage,
}) {
  const boxRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) return
    if (value && selectedLabel) setQuery(selectedLabel)
    else if (!value) setQuery('')
  }, [value, selectedLabel, open])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint && o.hint.toLowerCase().includes(q)),
    )
  }, [options, query])

  const clear = () => {
    onChange('', null)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="form-row mb-0" ref={boxRef}>
      {label ? <label className="form-label">{label}</label> : null}
      <div className="relative mt-1">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
        <input
          type="text"
          className="form-input w-full pl-[38px] pr-9"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            onQueryChange?.(v)
            if (value) onChange('', null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon text-text-muted"
            onClick={clear}
            aria-label={noneLabel}
            disabled={disabled}
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
        {open && !disabled && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-border rounded-lg shadow-lg max-h-[220px] overflow-auto z-[300]">
            {noneLabel ? (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[13px] text-text-muted hover:bg-[#F9FAFB] border-none bg-transparent cursor-pointer"
                onClick={clear}
              >
                {noneLabel}
              </button>
            ) : null}
            {loading && (
              <div className="px-3 py-2 text-xs text-text-muted">…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-text-muted">{emptyMessage || noneLabel || '—'}</div>
            )}
            {!loading && filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`w-full text-left px-3 py-2.5 border-none bg-transparent cursor-pointer hover:bg-primary-light ${
                  value === o.id ? 'bg-primary-light' : ''
                }`}
                onClick={() => {
                  onChange(o.id, o)
                  setQuery(o.label)
                  setOpen(false)
                }}
              >
                <div className="text-[13px] font-medium truncate">{o.label}</div>
                {o.hint ? <div className="text-[11px] text-text-muted truncate">{o.hint}</div> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
