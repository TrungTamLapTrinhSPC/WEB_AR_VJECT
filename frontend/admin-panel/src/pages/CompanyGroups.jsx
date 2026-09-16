import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { formatDateTime } from '../utils/helpers'
import { fetchCompanyGroups, deleteCompanyGroup } from '../api/companyGroups'

export default function CompanyGroups() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCompanyGroups()
      let list = res.data || []
      const q = search.trim().toLowerCase()
      if (q) list = list.filter((g) => g.name.toLowerCase().includes(q))
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load, dataVersion])

  const handleDelete = async (g) => {
    if (!window.confirm(t('cg_delete_confirm').replace('{name}', g.name))) return
    try {
      await deleteCompanyGroup(g.id)
      toast('success', t('deleted'))
      refreshData()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const columns = [
    {
      id: 'name',
      label: t('group_name_label'),
      primary: true,
      render: (g) => (
        <div className="td-flex">
          <div className="w-10 h-10 rounded-lg bg-primary-light text-primary-dark flex items-center justify-center shrink-0">
            <Icon name="building" size={20} />
          </div>
          <div>
            <div className="td-primary">{g.name}</div>
            <div className="text-xs text-text-muted font-mono">{String(g.id).slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'users',
      label: t('cg_users'),
      render: (g) => <span className="chip chip-blue">{g.user_count ?? 0}</span>,
    },
    {
      id: 'projects',
      label: t('cg_projects'),
      render: (g) => <span className="chip chip-gray">{g.project_count ?? 0}</span>,
    },
    {
      id: 'created',
      label: t('cg_created'),
      className: 'text-xs text-text-muted',
      hideOnMobile: true,
      render: (g) => formatDateTime(g.created_at),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('cg_title')}</div>
          <div className="page-sub">{t('cg_sub')}</div>
        </div>
        <button type="button" className="btn btn-p" onClick={() => openModal('group-new')}>
          <Icon name="plus" size={14} /> {t('group_create_short')}
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            placeholder={t('group_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> {t('refresh')}
        </button>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(g) => g.id}
        loading={loading}
        emptyMessage={t('cg_empty')}
        onRowClick={(g) => openModal('group-detail', { id: g.id })}
        actions={(g) => (
          <>
            <button
              type="button"
              className="btn btn-sm"
              onClick={(e) => { e.stopPropagation(); openModal('group-detail', { id: g.id }) }}
            >
              {t('cg_manage')}
            </button>
            <button type="button" className="btn-icon" onClick={(e) => { e.stopPropagation(); openModal('group-edit', { id: g.id, name: g.name }) }}>
              <Icon name="edit" size={16} />
            </button>
            <button type="button" className="btn-icon text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(g) }}>
              <Icon name="trash" size={16} />
            </button>
          </>
        )}
      />
    </>
  )
}
