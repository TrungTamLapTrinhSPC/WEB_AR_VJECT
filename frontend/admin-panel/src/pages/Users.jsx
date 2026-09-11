import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { initials, formatDateTime } from '../utils/helpers'
import { fetchUsers, fetchUserStats, deleteUser } from '../api/users'

const ROLE_KEY = { admin: 'admin', engineer: 'eng', bql: 'bql' }
const ROLE_COLOR = { admin: 'chip-red', engineer: 'chip-blue', bql: 'chip-orange' }

export default function Users() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (role) params.role = role
      const [list, st] = await Promise.all([
        fetchUsers(params),
        fetchUserStats().catch(() => null),
      ])
      setItems(list.data || [])
      setStats(st)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, role])

  useEffect(() => { load() }, [load, dataVersion])

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa người dùng này?')) return
    try {
      await deleteUser(id)
      toast('success', t('deleted') || 'Đã xóa')
      refreshData()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const columns = [
    {
      id: 'user',
      label: t('user_col_user'),
      primary: true,
      render: (u) => (
        <div className="td-flex">
          <div className="avatar">{initials(u.full_name)}</div>
          <div>
            <div className="td-primary">{u.full_name}</div>
            <div className="text-xs text-text-muted font-mono">{String(u.id).slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    { id: 'email', label: 'Email', render: (u) => u.email },
    {
      id: 'role',
      label: t('user_col_role'),
      render: (u) => (
        <span className={`chip ${ROLE_COLOR[u.role] || 'chip-gray'}`}>
          {t(`user_role_${ROLE_KEY[u.role] || 'eng'}`)}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('status'),
      render: () => (
        <span className="chip chip-green"><span className="dot" />{t('user_st_active')}</span>
      ),
    },
    {
      id: 'last',
      label: t('user_col_last'),
      className: 'text-xs text-text-muted',
      render: (u) => formatDateTime(u.updated_at || u.created_at),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('user_title')}</div>
          <div className="page-sub">{t('user_sub')}</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-p" onClick={() => openModal('user-new')}>
            <Icon name="plus" size={14} /> {t('user_new')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4">
        <div className="stat">
          <div className="stat-info"><div className="lbl">{t('user_total')}</div><div className="val">{stats?.total ?? '—'}</div></div>
          <div className="stat-icon"><Icon name="users" size={22} /></div>
        </div>
        <div className="stat">
          <div className="stat-info"><div className="lbl">{t('user_active_cnt')}</div><div className="val text-success">{stats?.active ?? '—'}</div></div>
          <div className="stat-icon green"><Icon name="check" size={22} /></div>
        </div>
        <div className="stat">
          <div className="stat-info"><div className="lbl">{t('user_engineer_cnt')}</div><div className="val">{stats?.engineers ?? '—'}</div></div>
          <div className="stat-icon orange"><Icon name="wrench" size={22} /></div>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder={t('user_search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('user_all_role')}</option>
          <option value="admin">{t('user_role_admin')}</option>
          <option value="engineer">{t('user_role_eng')}</option>
          <option value="bql">{t('user_role_bql')}</option>
        </select>
        <button type="button" className="btn" onClick={load}><Icon name="refresh" size={14} /> {t('refresh')}</button>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(u) => u.id}
        loading={loading}
        emptyMessage={t('empty_users')}
        actions={(u) => (
          <>
            <button type="button" className="btn-icon" onClick={() => openModal('user-edit', { id: u.id })}>
              <Icon name="edit" size={16} />
            </button>
            <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(u.id)}>
              <Icon name="trash" size={16} />
            </button>
          </>
        )}
      />
    </>
  )
}
