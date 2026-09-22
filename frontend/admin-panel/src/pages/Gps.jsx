import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { usePermissions } from '../hooks/usePermissions'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import GpsLeafletMap from '../components/GpsLeafletMap'
import { fetchGpsPois, deleteGpsPoi } from '../api/gps'

const TYPE_CHIP = {
  manhole: 'chip-orange',
  pipe_junction: 'chip-blue',
  valve: 'chip-green',
  cable_box: 'chip-purple',
}

export default function Gps() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const { canManageProjects, isAdmin, isBql } = usePermissions()
  const canEditGps = isAdmin || isBql
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [focusId, setFocusId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (type) params.type = type
      const list = await fetchGpsPois(params)
      setItems(list.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, type])

  useEffect(() => { load() }, [load, dataVersion])

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa POI này?')) return
    try {
      await deleteGpsPoi(id)
      toast('success', t('deleted') || 'Đã xóa')
      if (focusId === id) setFocusId(null)
      refreshData()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const openPoi = (g, edit) => {
    setFocusId(g.id)
    if (edit && canEditGps) openModal('gps-edit', { id: g.id })
  }

  const columns = [
    {
      id: 'name',
      label: t('gps_name'),
      primary: true,
      className: 'td-primary',
      render: (g) => g.name,
    },
    { id: 'project', label: t('qr_project'), render: (g) => g.project_name || '—' },
    {
      id: 'type',
      label: t('gps_type'),
      render: (g) => (
        <span className={`chip ${TYPE_CHIP[g.type] || 'chip-gray'}`}>{g.type}</span>
      ),
    },
    {
      id: 'coords',
      label: 'Lat / Lon',
      className: 'font-mono text-[11px]',
      render: (g) => (
        <>
          {Number(g.lat_wgs84).toFixed(4)}°N<br />{Number(g.lng_wgs84).toFixed(4)}°E
        </>
      ),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('gps_title')}</div>
          <div className="page-sub">{t('gps_sub')}</div>
        </div>
        <button type="button" className="btn btn-p" onClick={() => openModal('gps-new')}>
          <Icon name="plus" size={14} /> {t('gps_new')}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={16} />
              <input placeholder={t('gps_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
            </div>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('gps_all_type')}</option>
              <option value="manhole">{t('gps_manhole')}</option>
              <option value="pipe_junction">{t('gps_sub_station')}</option>
              <option value="valve">{t('gps_valve')}</option>
              <option value="cable_box">{t('gps_cable_box')}</option>
            </select>
          </div>
          <ResponsiveTable
            columns={columns}
            rows={items}
            rowKey={(g) => g.id}
            loading={loading}
            emptyMessage={t('empty_poi')}
            onRowClick={(g) => openPoi(g, canEditGps)}
            actions={(g) => (
              <>
                <button
                  type="button"
                  className="btn-icon"
                  title={t('gps_map_focus')}
                  onClick={(e) => { e.stopPropagation(); setFocusId(g.id) }}
                >
                  <Icon name="map-pin" size={16} />
                </button>
                {canEditGps && (
                  <button
                    type="button"
                    className="btn-icon"
                    title={t('gps_edit')}
                    onClick={(e) => { e.stopPropagation(); openModal('gps-edit', { id: g.id }) }}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                )}
                {canManageProjects && (
                  <button
                    type="button"
                    className="btn-icon text-danger"
                    title={t('delete')}
                    onClick={(e) => { e.stopPropagation(); handleDelete(g.id) }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </>
            )}
          />
        </div>
        <div className="card p-0 overflow-hidden min-h-[280px] sm:min-h-[360px] lg:min-h-[500px]">
          <GpsLeafletMap
            markers={items}
            focusId={focusId}
            onMarkerClick={(g) => openPoi(g, false)}
            poiCountLabel={`${items.length} POI`}
          />
        </div>
      </div>
    </>
  )
}
