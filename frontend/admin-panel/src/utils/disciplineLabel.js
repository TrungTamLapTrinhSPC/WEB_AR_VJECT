/** Nhãn bộ môn từ API (discipline_name / discipline_code / discipline). */
export function disciplineLabel(item) {
  if (!item) return '—'
  if (item.discipline_name) return item.discipline_name
  const code = item.discipline_code || item.discipline
  return code || '—'
}
