import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { initials } from '../utils/helpers'
import { fetchDashboardStats, fetchRecentFeedbacks, fetchRecentBim } from '../api/dashboard'
import { IMG } from '../data/images'

export default function Dashboard() {
  const { t } = useI18n()
  const { openModal } = useApp()
  const [stats, setStats] = useState(null)
  const [feedbacks, setFeedbacks] = useState([])
  const [bimList, setBimList] = useState([])

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(() => {})
    fetchRecentFeedbacks(5).then((r) => setFeedbacks(r.data || [])).catch(() => {})
    fetchRecentBim(4).then((r) => setBimList(r.data || [])).catch(() => {})
  }, [])

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('dash_title')}</div>
          <div className="page-sub">{t('dash_sub')}</div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <div className="stat">
          <div className="stat-info">
            <div className="lbl">{t('dash_st1')}</div>
            <div className="val">{stats?.active_projects ?? '—'}</div>
          </div>
          <div className="stat-icon"><Icon name="building" size={22} /></div>
        </div>
        <div className="stat">
          <div className="stat-info">
            <div className="lbl">{t('dash_st2')}</div>
            <div className="val">{stats?.bim_models ?? '—'}</div>
          </div>
          <div className="stat-icon purple"><Icon name="cube" size={22} /></div>
        </div>
        <div className="stat">
          <div className="stat-info">
            <div className="lbl">{t('dash_st3')}</div>
            <div className="val">{stats?.qr_markers ?? '—'}</div>
          </div>
          <div className="stat-icon green"><Icon name="qr" size={22} /></div>
        </div>
        <div className="stat">
          <div className="stat-info">
            <div className="lbl">{t('dash_st4')}</div>
            <div className="val text-danger">{stats?.open_feedbacks ?? '—'}</div>
          </div>
          <div className="stat-icon red"><Icon name="chat" size={22} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-title">{t('dash_recent_fb')}</div>
              <div className="card-sub">{t('dash_recent_fb_sub')}</div>
            </div>
            <Link to="/feedback" className="btn btn-sm">{t('dash_view_all')}</Link>
          </div>
          {feedbacks.map((f) => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              className="py-2.5 border-b border-border-light flex gap-3 items-start cursor-pointer"
              onClick={() => openModal('feedback', { id: f.id })}
            >
              <div className="avatar w-8 h-8 text-[11px]">{initials(f.user_name || '?')}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] mb-0.5">{f.title}</div>
                <div className="text-xs text-text-muted">{f.user_name} · {new Date(f.created_at).toLocaleDateString('vi-VN')}</div>
              </div>
              <span className={`prio prio-${f.priority === 'high' ? 'hi' : 'med'}`}>{(f.priority || '').toUpperCase()}</span>
            </div>
          ))}
          {feedbacks.length === 0 && <div className="text-sm text-text-muted py-4">{t('empty_data')}</div>}
        </div>

        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-title">{t('dash_bim_act')}</div>
              <div className="card-sub">{t('dash_bim_act_sub')}</div>
            </div>
            <Link to="/bim" className="btn btn-sm">{t('dash_view_all')}</Link>
          </div>
          {bimList.map((b, i) => (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              className="py-2.5 border-b border-border-light flex gap-3 items-center cursor-pointer"
              onClick={() => openModal('bim-detail', { id: b.id })}
            >
              <div className="thumb">
                <img src={IMG.bim[i % IMG.bim.length]} alt="" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px]">{b.name || b.project_name} <span className="text-text-muted font-normal">· {b.version}</span></div>
                <div className="text-xs text-text-muted">{b.project_name}</div>
              </div>
            </div>
          ))}
          {bimList.length === 0 && <div className="text-sm text-text-muted py-4">{t('empty_data')}</div>}
        </div>
      </div>
    </>
  )
}
