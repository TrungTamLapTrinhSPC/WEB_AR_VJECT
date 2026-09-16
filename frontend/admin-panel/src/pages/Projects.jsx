import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { usePermissions } from '../hooks/usePermissions'
import Icon from '../components/Icon'
import { fetchProjects } from '../api/projects'
import { IMG } from '../data/images'

const STATUS_CHIP = {
  active: 'chip-green',
  completed: 'chip-yellow',
  archived: 'chip-gray',
}

const STATUS_LABEL = {
  active: 'prj_st_active',
  completed: 'prj_st_archive',
  archived: 'prj_st_archive',
}

export default function Projects() {
  const { t } = useI18n()
  const { openModal, projectsVersion } = useApp()
  const { canManageProjects, canManageProjectTeam } = usePermissions()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (status) params.status = status
      const res = await fetchProjects(params)
      setProjects(res.data || [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    load()
  }, [load, projectsVersion])

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('prj_title')}</div>
          <div className="page-sub">{t('prj_sub')}</div>
        </div>
        {canManageProjects && (
          <button type="button" className="btn btn-p" onClick={() => openModal('project-new')}>
            <Icon name="plus" size={14} /> {t('prj_new')}
          </button>
        )}
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            placeholder={t('prj_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('prj_filter_status')}</option>
          <option value="active">{t('prj_st_active')}</option>
          <option value="completed">{t('prj_st_archive')}</option>
          <option value="archived">{t('prj_st_archive')}</option>
        </select>
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> {t('refresh')}
        </button>
      </div>

      {canManageProjectTeam && (
        <div className="card p-4 mb-4 text-sm leading-relaxed border border-border bg-[#F9FAFB]">
          <div className="font-bold mb-1">{t('prj_team_help_title')}</div>
          <p className="text-text-muted m-0">{t('prj_team_help_body')}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('loading')}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          {canManageProjects ? t('empty_projects') : t('empty_projects_assigned')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const stChip = STATUS_CHIP[p.status] || 'chip-gray'
            const stKey = STATUS_LABEL[p.status] || 'prj_st_active'
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className="card p-0 overflow-hidden cursor-pointer"
                onClick={() => openModal('project', { id: p.id })}
                onKeyDown={(e) => e.key === 'Enter' && openModal('project', { id: p.id })}
              >
                <div className="h-[150px] relative overflow-hidden bg-border-light">
                  <img src={IMG.proj[i % IMG.proj.length]} className="w-full h-full object-cover" alt="" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/65" />
                  <span className={`chip ${stChip} absolute top-2.5 right-2.5 bg-white/95`}>{t(stKey)}</span>
                </div>
                <div className="p-3.5">
                  <div className="font-bold text-sm mb-0.5">{p.name}</div>
                  <div className="text-xs text-text-muted mb-2">📍 {p.address || '—'}</div>
                  <div className="flex gap-3.5 text-xs pt-2.5 border-t border-dashed border-border">
                    <div><b className="text-text">{p.qr_count ?? 0}</b> <span className="text-xs text-text-muted">{t('prj_qr')}</span></div>
                    <div><b className="text-text">{p.bim_count ?? 0}</b> <span className="text-xs text-text-muted">{t('prj_bim')}</span></div>
                    <div><b className="text-danger">{p.open_feedback_count ?? 0}</b> <span className="text-xs text-text-muted">{t('prj_open')}</span></div>
                  </div>
                  {p.assigned_group_names ? (
                    <div className="text-xs text-text-muted mt-2 pt-2 border-t border-dashed border-border">
                      <span className="font-semibold text-text">{t('user_company_group')}:</span>{' '}
                      {p.assigned_group_names}
                    </div>
                  ) : null}
                  {canManageProjectTeam && (
                    <button
                      type="button"
                      className="btn btn-sm w-full mt-3"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModal('project', { id: p.id, tab: 'team' })
                      }}
                    >
                      <Icon name="users" size={14} /> {t('prj_team_btn')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
