import { useI18n } from '../context/I18nContext'

/**
 * Desktop: table. Mobile (< md): card list.
 * columns: { id, label, render?(row), primary?, className?, hideOnMobile? }
 */
export default function ResponsiveTable({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage,
  actions,
  onRowClick,
}) {
  const { t } = useI18n()
  const empty = emptyMessage ?? t('empty_data')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.id] ?? '—')

  if (loading) {
    return (
      <>
        <div className="table-wrap hidden md:block">
          <div className="text-center py-8 text-text-muted text-[13px]">{t('loading')}</div>
        </div>
        <div className="mobile-cards md:hidden">
          <div className="mobile-card text-center text-text-muted text-[13px] py-8">{t('loading')}</div>
        </div>
      </>
    )
  }

  if (!rows.length) {
    return (
      <>
        <div className="table-wrap hidden md:block">
          <div className="text-center py-8 text-text-muted text-[13px]">{empty}</div>
        </div>
        <div className="mobile-cards md:hidden">
          <div className="mobile-card text-center text-text-muted text-[13px] py-8">{empty}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="table-wrap hidden md:block">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} className={col.headerClassName}>{col.label}</th>
              ))}
              {actions && <th className="text-right">{columns.actionsLabel || t('action')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.id} className={col.className}>
                    {cell(col, row)}
                  </td>
                ))}
                {actions && (
                  <td className="text-right">
                    <div className="row-actions justify-end">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards md:hidden">
        {rows.map((row) => {
          const primaryCol = columns.find((c) => c.primary) || columns[0]
          const restCols = columns.filter((c) => c !== primaryCol && !c.hideOnMobile)

          return (
            <div
              key={rowKey(row)}
              className={`mobile-card${onRowClick ? ' mobile-card-clickable' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              <div className="mobile-card-hd">
                <div className={`mobile-card-primary ${primaryCol.className || ''}`}>
                  {cell(primaryCol, row)}
                </div>
                {actions && (
                  <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </div>
                )}
              </div>
              <div className="mobile-card-body">
                {restCols.map((col) => (
                  <div key={col.id} className="mobile-card-row">
                    <span className="mobile-card-label">{col.label}</span>
                    <span className={`mobile-card-value ${col.className || ''}`}>{cell(col, row)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
