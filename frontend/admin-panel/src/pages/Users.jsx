import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import ResponsiveTable from '../components/ResponsiveTable'
import { initials, formatDateTime } from '../utils/helpers'
import { fetchUsers, fetchUserStats, deleteUser } from '../api/users'
import { fetchCompanyGroups } from '../api/companyGroups'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'

const ROLE_KEY = { admin: 'admin', engineer: 'eng', bql: 'bql' }
const ROLE_COLOR = { admin: 'chip-red', engineer: 'chip-blue', bql: 'chip-orange' }

export default function Users() {
  const { t } = useI18n()
  const { openModal, toast, dataVersion, refreshData } = useApp()
  const { isAdmin } = usePermissions()
  const { user: currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (role) params.role = role
      if (groupFilter) params.company_group_id = groupFilter
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
  }, [search, role, groupFilter])

  useEffect(() => { load() }, [load, dataVersion])
  useEffect(() => {
    fetchCompanyGroups().then((r) => setGroups(r.data || [])).catch(() => setGroups([]))
  }, [dataVersion])

  const handleDelete = async (id) => {
    if (!isAdmin) {
      toast('err', t('user_delete_forbidden'))
      return
    }
    if (id === currentUser?.id) {
      toast('err', t('user_delete_self'))
      return
    }
    if (!window.confirm(t('user_delete_confirm'))) return
    try {
      await deleteUser(id)
      toast('success', t('deleted') || 'Đã xóa')
      refreshData()
      load()
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
      id: 'company_group_name',
      label: t('user_company_group'),
      hideOnMobile: true,
      render: (u) => (
        u.company_group_name ? (
          <button
            type="button"
            className="chip chip-blue border-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (u.company_group_id) openModal('group-detail', { id: u.company_group_id })
            }}
          >
            {u.company_group_name}
          </button>
        ) : (
          <span className="text-text-muted text-xs">{t('group_no_group')}</span>
        )
      ),
    },
    {
      id: 'role',
      label: t('user_col_role'),
      render: (u) => (
        <span className={`chip ${ROLE_COLOR[u.role] || 'chip-gray'}`}>
          {t(`user_role_${ROLE_KEY[u.role] || 'eng'}`)}
          {u.role === 'bql' && u.can_assign_engineers ? (
            <span className="ml-1 opacity-80" title={t('user_can_assign_eng')}>★</span>
          ) : null}
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
      hideOnMobile: true,
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
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Link to="/groups" className="btn no-underline">
              <Icon name="building" size={14} /> {t('nav_groups')}
            </Link>
          )}
          <button type="button" className="btn btn-p" onClick={() => openModal('user-new')}>
            <Icon name="plus" size={14} /> {t('user_new')}
          </button>
        </div>
      </div>
      <div className="card p-4 mb-4 text-sm leading-relaxed border border-border bg-[#F9FAFB]">
        <div className="font-bold mb-1">{t('user_group_help_title')}</div>
        <p className="text-text-muted m-0 mb-2">{t('user_group_help_body')}</p>
        {isAdmin && (
          <Link to="/groups" className="text-primary-dark font-semibold text-[13px]">{t('cg_manage')} → {t('nav_groups')}</Link>
        )}
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
        <select className="select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">{t('cg_all_groups')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={load}><Icon name="refresh" size={14} /> {t('refresh')}</button>
      </div>
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(u) => u.id}
        loading={loading}
        emptyMessage={t('empty_users')}
        onRowClick={(u) => openModal('user-edit', { id: u.id })}
        actions={(u) => (
          <>
            <button type="button" className="btn-icon" onClick={(e) => { e.stopPropagation(); openModal('user-edit', { id: u.id }) }}>
              <Icon name="edit" size={16} />
            </button>
            {isAdmin && u.id !== currentUser?.id ? (
              <button type="button" className="btn-icon text-danger" title={t('delete')} onClick={(e) => { e.stopPropagation(); handleDelete(u.id) }}>
                <Icon name="trash" size={16} />
              </button>
            ) : null}
          </>
        )}
      />
    </>
  )
}
