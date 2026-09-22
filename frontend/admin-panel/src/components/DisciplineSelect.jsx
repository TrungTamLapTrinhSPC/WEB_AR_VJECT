import { useEffect, useState } from 'react'
import { fetchDisciplines } from '../api/disciplines'

const FALLBACK = [
  { id: 1, code: 'architecture', name: 'Kiến trúc' },
  { id: 2, code: 'structure', name: 'Kết cấu' },
  { id: 3, code: 'plumbing', name: 'Cấp thoát nước' },
  { id: 4, code: 'electrical', name: 'Điện' },
  { id: 5, code: 'hvac', name: 'Thông gió - Điều hòa' },
  { id: 6, code: 'other', name: 'Khác' },
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
          {d.name}
        </option>
      ))}
    </select>
  )
}
