import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { fetchElements } from '../api/misc'
import { fetchBimModels } from '../api/bim'

const CAT_CHIP = { electric: 'chip-yellow', water: 'chip-blue', hvac: 'chip-green', fire: 'chip-red' }

export default function Elements() {
  const { t } = useI18n()
  const { openModal, dataVersion } = useApp()
  const [items, setItems] = useState([])
  const [bimList, setBimList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modelId, setModelId] = useState('')
  const [cat, setCat] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (modelId) params.model_id = modelId
      if (cat) params.discipline = cat
      const res = await fetchElements(params)
      setItems(res.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, modelId, cat])

  useEffect(() => { load() }, [load, dataVersion])
  useEffect(() => {
    fetchBimModels({ limit: 50 }).then((r) => setBimList(r.data || [])).catch(() => {})
  }, [])

  const columns = [
    {
      id: 'name',
      label: t('ele_name'),
      primary: true,
      render: (e) => (
        <div>
          <div className="font-semibold">{e.name}</div>
          <div className="font-mono text-xs text-text-muted mt-0.5">{e.id}</div>
        </div>
      ),
    },
    {
      id: 'cat',
      label: t('ele_cat'),
      render: (e) => (
        <span className={`chip ${CAT_CHIP[e.cat] || 'chip-gray'}`}>
          {t(`ele_${e.cat}`) || e.cat}
        </span>
      ),
    },
    { id: 'bim', label: t('ele_bim_model'), className: 'text-xs text-text-muted', render: (e) => e.bim },
    { id: 'maker', label: t('ele_maker'), className: 'text-xs text-text-muted', render: (e) => e.maker },
    {
      id: 'status',
      label: t('status'),
      render: (e) => (
        <span className={`chip ${e.status === 'active' ? 'chip-green' : 'chip-yellow'}`}>
          <span className="dot" />
          {t(`ele_st_${e.status === 'active' ? 'active' : 'maint'}`)}
        </span>
      ),
    },
    {
      id: 'fb',
      label: t('ele_fb'),
      render: (e) => (
        e.fb > 0 ? <span className="chip chip-red">{e.fb}</span> : <span className="text-xs text-text-muted">-</span>
      ),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('ele_title')}</div>
          <div className="page-sub">{t('ele_sub')}</div>
        </div>
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> {t('refresh')}
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('ele_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t('ele_all_cat')}</option>
          <option value="electric">{t('ele_electric')}</option>
          <option value="water">{t('ele_water')}</option>
          <option value="hvac">{t('ele_hvac')}</option>
          <option value="fire">{t('ele_fire')}</option>
        </select>
        <select className="select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">{t('ele_all_bim')}</option>
          {bimList.map((b) => (
            <option key={b.id} value={b.id}>{b.name || b.version}</option>
          ))}
        </select>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(e) => `${e.id}-${e.model_id}`}
        loading={loading}
        emptyMessage={t('empty_elements')}
        onRowClick={(e) => openModal('element-detail', { id: e.id })}
        actions={(e) => (
          <button type="button" className="btn-icon" onClick={() => openModal('element-detail', { id: e.id })}>
            <Icon name="eye" size={16} />
          </button>
        )}
      />
    </>
  )
}
