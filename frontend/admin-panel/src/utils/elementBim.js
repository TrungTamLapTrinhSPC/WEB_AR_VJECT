/** Nhãn cột BIM trên trang Cấu kiện (không dùng gạch ngang mơ hồ). */
export function elementBimLabel(e, t) {
  if (!e?.model_id) return t('ele_bim_unlinked')
  const label = (e.bim || '').trim()
  if (label && label !== '—') return label
  return `${String(e.model_id).slice(0, 8)}…`
}
