/** JOIN + SELECT cho bim_models ↔ disciplines */
export const BIM_DISCIPLINE_JOIN = 'LEFT JOIN disciplines d ON d.id = b.discipline_id'

export const BIM_DISCIPLINE_FIELDS = `
  d.code AS discipline_code,
  d.name AS discipline_name,
  d.code AS discipline
`

const CODE_ALIASES = {
  architectural: 'architecture',
  arch: 'architecture',
  architecture: 'architecture',
  structural: 'structure',
  struct: 'structure',
  structure: 'structure',
  mep: 'hvac',
  hvac: 'hvac',
  plumbing: 'plumbing',
  water: 'plumbing',
  electrical: 'electrical',
  electric: 'electrical',
  other: 'other',
}

export function normalizeDisciplineCode(raw) {
  if (raw == null || raw === '') return 'other'
  const key = String(raw).trim().toLowerCase()
  return CODE_ALIASES[key] || key
}

/**
 * @param {import('../db/pool.js').queryOne} queryOne
 * @param {string|number|null|undefined} discipline — code hoặc id
 * @param {number|null|undefined} disciplineId
 */
export async function resolveDisciplineId(queryOne, { discipline, discipline_id: disciplineId } = {}) {
  if (disciplineId != null && disciplineId !== '') {
    const byId = await queryOne('SELECT id FROM disciplines WHERE id = ?', [disciplineId])
    if (byId) return byId.id
  }

  const code = normalizeDisciplineCode(discipline ?? 'other')
  const byCode = await queryOne('SELECT id FROM disciplines WHERE code = ?', [code])
  if (byCode) return byCode.id

  const other = await queryOne("SELECT id FROM disciplines WHERE code = 'other' LIMIT 1")
  if (!other) {
    throw new Error('disciplines table missing — run migration 005_disciplines.sql')
  }
  return other.id
}
