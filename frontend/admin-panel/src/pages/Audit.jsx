import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { formatDateTime } from '../utils/helpers'
import { fetchAuditLogs } from '../api/misc'

function actionChipClass(action) {
  if (String(action).includes('DELETE') || String(action).includes('FAILED')) return 'chip-red'
  if (String(action).includes('CREATE') || String(action).includes('LOGIN')) return 'chip-blue'
  if (String(action).includes('RESOLVE') || String(action).includes('LOGOUT')) return 'chip-green'
  return 'chip-yellow'
}

export default function Audit() {
  const { t } = useI18n()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (action) params.action = action
      const res = await fetchAuditLogs(params)
      setLogs(res.data || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [search, action])

  useEffect(() => { load() }, [load])

  const columns = [
    {
      id: 'user',
      label: t('audit_user'),
      primary: true,
      render: (l) => l.user,
    },
    {
      id: 'time',
      label: t('audit_time'),
      className: 'font-mono text-xs text-text-muted',
      render: (l) => formatDateTime(l.created_at || l.time),
    },
    {
      id: 'action',
      label: t('audit_action'),
      render: (l) => (
        <span className={`chip ${actionChipClass(l.action)} font-mono`}>{l.action}</span>
      ),
    },
    {
      id: 'target',
      label: t('audit_target'),
      className: 'text-xs text-text-muted',
      render: (l) => l.target,
    },
    {
      id: 'ip',
      label: 'IP',
      className: 'font-mono text-xs text-text-muted',
      render: (l) => l.ip,
    },
    {
      id: 'status',
      label: t('audit_result'),
      render: (l) => (
        <span className={`chip ${l.status === 'ok' ? 'chip-green' : 'chip-red'}`}>
          <span className="dot" />
          {t(`audit_${l.status || 'ok'}`)}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('audit_title')}</div>
          <div className="page-sub">{t('audit_sub')}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={load}>
            <Icon name="refresh" size={14} /> {t('refresh')}
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('audit_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t('audit_all_act')}</option>
          <option value="LOGIN">LOGIN</option>
          <option value="LOGOUT">LOGOUT</option>
        </select>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={logs}
        rowKey={(l) => l.id}
        loading={loading}
        emptyMessage={t('empty_audit')}
      />
    </>
  )
}
