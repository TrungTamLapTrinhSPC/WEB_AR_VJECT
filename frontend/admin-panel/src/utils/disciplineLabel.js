/** Translated discipline name by code (`disc_<code>`), falling back to the DB name. */
export function disciplineName(code, fallbackName, t) {
  if (t && code) {
    const key = `disc_${code}`
    const label = t(key)
    if (label && label !== key) return label
  }
  return fallbackName || code || '—'
}

/** Nhãn bộ môn từ API (discipline_name / discipline_code / discipline). */
export function disciplineLabel(item, t) {
  if (!item) return '—'
  return disciplineName(item.discipline_code || item.discipline, item.discipline_name, t)
}
