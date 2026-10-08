import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { formatDateTime } from '../utils/helpers'
import {
  createProjectAttributeGroup,
  deleteProjectAttributeGroup,
  fetchProjectAttributeGroups,
  updateProjectAttributeGroup,
} from '../api/projectAttributeGroups'

export default function ProjectAttributeGroups() {
  const { t } = useI18n()
  const { toast, dataVersion } = useApp()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3B82F6')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchProjectAttributeGroups()
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

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createProjectAttributeGroup({ name, color: newColor })
      setNewName('')
      toast('success', t('saved'))
      load()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (g) => {
    if (!window.confirm(t('pag_delete_confirm').replace('{name}', g.name))) return
    try {
      await deleteProjectAttributeGroup(g.id)
      toast('success', t('deleted'))
      load()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleColor = async (g, color) => {
    try {
      await updateProjectAttributeGroup(g.id, { color })
      load()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const columns = [
    {
      id: 'name',
      label: t('pag_name'),
      primary: true,
      render: (g) => (
        <div className="td-flex">
          <span
            className="w-10 h-10 rounded-lg shrink-0 border border-border"
            style={{ background: g.color || '#3B82F6' }}
          />
          <div>
            <div className="td-primary">{g.name}</div>
            <div className="text-xs text-text-muted font-mono">{String(g.id).slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      id: 'projects',
      label: t('cg_projects'),
      render: (g) => <span className="chip chip-gray">{g.project_count ?? 0}</span>,
    },
    {
      id: 'color',
      label: t('pag_color'),
      render: (g) => (
        <input
          type="color"
          value={g.color || '#3B82F6'}
          className="w-10 h-8 cursor-pointer border-0 bg-transparent"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleColor(g, e.target.value)}
        />
      ),
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
          <div className="page-title">{t('pag_title')}</div>
          <div className="page-sub">{t('pag_sub')}</div>
        </div>
      </div>
      <div className="card p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="form-label">{t('pag_name')}</label>
          <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div>
          <label className="form-label">{t('pag_color')}</label>
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-[42px] w-14" />
        </div>
        <button type="button" className="btn btn-p" disabled={creating || !newName.trim()} onClick={handleCreate}>
          <Icon name="plus" size={14} /> {t('pag_create')}
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
        emptyMessage={t('pag_empty')}
        actions={(g) => (
          <button type="button" className="btn-icon text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(g) }}>
            <Icon name="trash" size={16} />
          </button>
        )}
      />
    </>
  )
}
