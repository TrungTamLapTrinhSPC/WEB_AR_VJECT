import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { usePermissions } from '../hooks/usePermissions'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { formatDate } from '../utils/helpers'
import { fetchQrMarkers, deleteQrMarker, fetchQrMarkerImageBlob, downloadQrMarkerPng } from '../api/qr'
import { fetchProjects } from '../api/projects'

function QrThumb({ markerId, url }) {
  const [src, setSrc] = useState(null)
  const [useApi, setUseApi] = useState(!url)

  useEffect(() => {
    if (!useApi || !markerId) return undefined
    let objectUrl
    let cancelled = false
    fetchQrMarkerImageBlob(markerId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [markerId, useApi])

  if (!useApi && url) {
    return (
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setUseApi(true)}
      />
    )
  }
  if (src) {
    return <img src={src} alt="" className="w-full h-full object-cover" />
  }
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

function markerTypeLabel(t, type) {
  if (type === 'tabletop') return t('qr_type_tabletop')
  return t('qr_type_field')
}

export default function Qr() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const { isAdmin, isBql } = usePermissions()
  const canEditQr = isAdmin || isBql
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [markerType, setMarkerType] = useState('')

  const hadItemsRef = useRef(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (projectId) params.project_id = projectId
      if (markerType) params.marker_type = markerType
      const res = await fetchQrMarkers(params)
      const next = res.data || []
      setItems(next)
      hadItemsRef.current = next.length > 0
    } catch {
      setItems([])
      hadItemsRef.current = false
    } finally {
      if (!silent) setLoading(false)
    }
  }, [search, projectId, markerType])

  useEffect(() => {
    load({ silent: hadItemsRef.current })
  }, [load, dataVersion])
  useEffect(() => {
    fetchProjects({ limit: 50 }).then((r) => setProjects(r.data || [])).catch(() => {})
  }, [])

  const openView = (q, e) => {
    e?.stopPropagation()
    openModal('qr-view', { id: q.id, marker_code: q.marker_code })
  }

  const handleDownload = async (q, e) => {
    e?.stopPropagation()
    try {
      await downloadQrMarkerPng(q.id, q.marker_code)
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('qr_delete_confirm'))) return
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
          <button
            type="button"
            className="thumb bg-white border border-border w-11 h-11 text-text shrink-0 cursor-pointer hover:ring-2 hover:ring-accent/40 rounded"
            title={t('qr_view')}
            onClick={(e) => openView(q, e)}
          >
            <QrThumb markerId={q.id} url={q.qr_image_url} />
          </button>
          <span className="td-primary font-mono">{q.marker_code}</span>
        </div>
      ),
    },
    {
      id: 'type',
      label: t('qr_marker_type'),
      render: (q) => (
        <span className={`chip ${q.marker_type === 'tabletop' ? 'chip-blue' : 'chip-gray'}`}>
          {markerTypeLabel(t, q.marker_type)}
        </span>
      ),
    },
    { id: 'project', label: t('qr_project'), render: (q) => q.project_name },
    { id: 'floor', label: t('qr_floor'), render: (q) => q.floor_level || '—' },
    {
      id: 'pos',
      label: t('qr_pos'),
      className: 'font-mono text-xs text-text-muted',
      hideOnMobile: true,
      render: (q) => `${q.bim_pos_x}, ${q.bim_pos_y}, ${q.bim_pos_z}`,
    },
    {
      id: 'size',
      label: t('qr_size'),
      hideOnMobile: true,
      render: (q) => {
        if (q.marker_type === 'tabletop' && q.paper_size) {
          return `${q.paper_size} · ${q.tabletop_scale ?? '—'}`
        }
        return q.physical_width_m ? `${Math.round(q.physical_width_m * 100)}cm` : '—'
      },
    },
    {
      id: 'installed',
      label: t('qr_installed'),
      className: 'text-xs text-text-muted',
      hideOnMobile: true,
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
        <select className="select" value={markerType} onChange={(e) => setMarkerType(e.target.value)}>
          <option value="">{t('qr_all_types')}</option>
          <option value="field">{t('qr_type_field')}</option>
          <option value="tabletop">{t('qr_type_tabletop')}</option>
        </select>
        <button type="button" className="btn" onClick={load}><Icon name="refresh" size={14} /> {t('refresh')}</button>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(q) => q.id}
        loading={loading}
        emptyMessage={t('empty_qr')}
        onRowClick={(q) => openModal('qr-view', { id: q.id, marker_code: q.marker_code })}
        actions={(q) => (
          <>
            <button type="button" className="btn-icon" title={t('qr_view')} onClick={(e) => openView(q, e)}>
              <Icon name="eye" size={16} />
            </button>
            <button type="button" className="btn-icon" title={t('qr_download')} onClick={(e) => handleDownload(q, e)}>
              <Icon name="download" size={16} />
            </button>
            {canEditQr ? (
              <>
                <button type="button" className="btn-icon" title={t('qr_edit')} onClick={(e) => { e.stopPropagation(); openModal('qr-edit', { id: q.id }) }}>
                  <Icon name="edit" size={16} />
                </button>
                {isAdmin ? (
                  <button type="button" className="btn-icon text-danger" title={t('delete')} onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}>
                    <Icon name="trash" size={16} />
                  </button>
                ) : null}
              </>
            ) : null}
          </>
        )}
      />
    </>
  )
}
