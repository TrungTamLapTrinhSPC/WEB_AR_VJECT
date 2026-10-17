import { useEffect, useState } from 'react'
import { fetchDisciplines } from '../api/disciplines'
import { useI18n } from '../context/I18nContext'
import { disciplineName } from '../utils/disciplineLabel'

const FALLBACK = [
  { id: 1, code: 'architecture' },
  { id: 2, code: 'structure' },
  { id: 3, code: 'plumbing' },
  { id: 4, code: 'electrical' },
  { id: 5, code: 'hvac' },
  { id: 6, code: 'other' },
]

/** Select bộ môn BIM — `value` = code (gửi API qua `discipline`). */
export default function DisciplineSelect({
  value,
  onChange,
  className = 'form-select',
  disabled = false,
  required = false,
  id,
}) {
  const { t } = useI18n()
  const [list, setList] = useState(FALLBACK)

  useEffect(() => {
    fetchDisciplines()
      .then((r) => {
        if (r.data?.length) setList(r.data)
      })
      .catch(() => {})
  }, [])

  return (
    <select
      id={id}
      className={className}
      value={value || 'other'}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
    >
      {list.map((d) => (
        <option key={d.id ?? d.code} value={d.code}>
          {disciplineName(d.code, d.name, t)}
        </option>
      ))}
    </select>
  )
}
