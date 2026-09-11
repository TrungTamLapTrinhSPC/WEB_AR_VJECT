import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { usePermissions } from '../hooks/usePermissions'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { fetchGpsPois, fetchGpsMap, deleteGpsPoi } from '../api/gps'

const TYPE_CHIP = {
  manhole: 'chip-orange',
  pipe_junction: 'chip-blue',
  valve: 'chip-green',
  cable_box: 'chip-purple',
}

export default function Gps() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const { canManageProjects } = usePermissions()
  const [items, setItems] = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (type) params.type = type
      const [list, map] = await Promise.all([
        fetchGpsPois(params),
        fetchGpsMap().catch(() => ({ features: [] })),
      ])
      setItems(list.data || [])
      setFeatures(map.features || [])
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
      refreshData()
    } catch (err) {
      toast('err', err.message)
    }
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
            actions={canManageProjects ? (g) => (
              <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(g.id)}>
                <Icon name="trash" size={16} />
              </button>
            ) : undefined}
          />
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="h-[280px] sm:h-[360px] lg:h-[500px] bg-gradient-to-br from-[#DDE7F5] to-[#C8DAF0] relative">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(0,0,0,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.04) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
            {features.map((f, i) => {
              const [lng, lat] = f.geometry?.coordinates || []
              const left = 8 + ((Number(lng) % 1) * 80)
              const top = 8 + ((Number(lat) % 1) * 80)
              return (
                <div
                  key={f.properties?.id || i}
                  title={f.properties?.name}
                  className="absolute w-[22px] h-[22px] bg-warning rotate-45 border-[3px] border-white shadow-[0_0_0_2px_#F59E0B,0_2px_6px_rgba(0,0,0,.3)] cursor-pointer"
                  style={{ top: `${top}%`, left: `${left}%` }}
                />
              )
            })}
            <div className="absolute top-3.5 left-3.5 bg-white px-3 py-2.5 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,.1)] text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-warning rotate-45" /> {features.length} POI
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
