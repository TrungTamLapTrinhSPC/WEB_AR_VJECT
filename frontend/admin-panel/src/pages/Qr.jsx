import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { usePermissions } from '../hooks/usePermissions'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { formatDate } from '../utils/helpers'
import { fetchQrMarkers, deleteQrMarker } from '../api/qr'
import { fetchProjects } from '../api/projects'

function QrThumb({ url }) {
  if (url) return <img src={url} alt="" className="w-full h-full object-cover" />
  return (
    <svg viewBox="0 0 100 100" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="4">
      <rect x="10" y="10" width="24" height="24" />
      <rect x="66" y="10" width="24" height="24" />
      <rect x="10" y="66" width="24" height="24" />
      <rect x="40" y="15" width="6" height="6" fill="currentColor" stroke="none" />
      <rect x="50" y="25" width="6" height="6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function Qr() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const { canManageProjects } = usePermissions()
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (projectId) params.project_id = projectId
      const res = await fetchQrMarkers(params)
      setItems(res.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, projectId])

  useEffect(() => { load() }, [load, dataVersion])
  useEffect(() => {
    fetchProjects({ limit: 50 }).then((r) => setProjects(r.data || [])).catch(() => {})
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa QR marker này?')) return
    try {
      await deleteQrMarker(id)
      toast('success', t('deleted') || 'Đã xóa')
      refreshData()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const columns = [
    {
      id: 'code',
      label: t('qr_code'),
      primary: true,
      render: (q) => (
        <div className="td-flex">
          <div className="thumb bg-white border border-border w-11 h-11 text-text">
            <QrThumb url={q.qr_image_url} />
          </div>
          <span className="td-primary font-mono">{q.marker_code}</span>
        </div>
      ),
    },
    { id: 'project', label: t('qr_project'), render: (q) => q.project_name },
    { id: 'floor', label: t('qr_floor'), render: (q) => q.floor_level || '—' },
    {
      id: 'pos',
      label: t('qr_pos'),
      className: 'font-mono text-xs text-text-muted',
      render: (q) => `${q.bim_pos_x}, ${q.bim_pos_y}, ${q.bim_pos_z}`,
    },
    {
      id: 'size',
      label: t('qr_size'),
      render: (q) => (q.physical_width_m ? `${Math.round(q.physical_width_m * 100)}cm` : '—'),
    },
    {
      id: 'status',
      label: t('status'),
      render: () => (
        <span className="chip chip-green"><span className="dot" />{t('qr_st_active')}</span>
      ),
    },
    {
      id: 'installed',
      label: t('qr_installed'),
      className: 'text-xs text-text-muted',
      render: (q) => formatDate(q.created_at),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('qr_title')}</div>
          <div className="page-sub">{t('qr_sub')}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-p" onClick={() => openModal('qr-new')}>
            <Icon name="plus" size={14} /> {t('qr_new')}
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('qr_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t('bim_all_proj')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={load}><Icon name="refresh" size={14} /> {t('refresh')}</button>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(q) => q.id}
        loading={loading}
        emptyMessage={t('empty_qr')}
        actions={canManageProjects ? (q) => (
          <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(q.id)}>
            <Icon name="trash" size={16} />
          </button>
        ) : undefined}
      />
    </>
  )
}
