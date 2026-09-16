import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import S3Image from '../components/S3Image'
import { initials, formatDate } from '../utils/helpers'
import { getBimFirstPreviewUrl } from '../utils/bimPreview'
import { fetchBimModels } from '../api/bim'
import { fetchProjects } from '../api/projects'

export default function Bim() {
  const { t } = useI18n()
  const { openModal, dataVersion } = useApp()
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('')
  const [discipline, setDiscipline] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      if (projectId) params.project_id = projectId
      if (discipline) params.discipline = discipline
      const res = await fetchBimModels(params)
      setItems(res.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, projectId, discipline])

  useEffect(() => { load() }, [load, dataVersion])
  useEffect(() => {
    fetchProjects({ limit: 50 }).then((r) => setProjects(r.data || [])).catch(() => {})
  }, [])

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('bim_title')}</div>
          <div className="page-sub">{t('bim_sub')}</div>
        </div>
        <button type="button" className="btn btn-p" onClick={() => openModal('bim-upload')}>
          <Icon name="upload" size={14} /> {t('bim_upload')}
        </button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            placeholder={t('bim_search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t('bim_all_proj')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="select" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">{t('bim_all_type')}</option>
          <option value="architectural">{t('bim_indoor')}</option>
          <option value="mep">{t('bim_outdoor')}</option>
          <option value="structural">Structural</option>
          <option value="other">Other</option>
        </select>
        <button type="button" className="btn" onClick={load}>
          <Icon name="refresh" size={14} /> {t('refresh')}
        </button>
      </div>
      {loading ? (
        <div className="text-center py-12 text-text-muted">{t('loading')}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-text-muted">{t('empty_bim')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((b) => {
            const preview = getBimFirstPreviewUrl(b)
            const previewFallback = (
              <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-[#F9FAFB]">
                <Icon name="cube" size={32} className="opacity-40 text-text-muted" />
              </div>
            )
            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                className="card p-0 overflow-hidden cursor-pointer"
                onClick={() => openModal('bim-detail', { id: b.id })}
                onKeyDown={(e) => e.key === 'Enter' && openModal('bim-detail', { id: b.id })}
              >
                <div className="aspect-[16/10] relative overflow-hidden bg-border-light">
                  <S3Image
                    src={preview || ''}
                    className="w-full h-full object-cover"
                    fallback={previewFallback}
                  />
                  <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                    <span className="chip chip-blue bg-[rgba(227,242,253,.95)]">{b.discipline || 'other'}</span>
                    <span className="chip chip-green bg-[rgba(220,252,231,.95)]">{b.version}</span>
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="font-bold text-[13px] mb-0.5">{b.name || '—'}</div>
                  <div className="text-xs text-text-muted">{b.project_name} · {b.version}</div>
                  <div className="flex justify-between items-center mt-2 pt-2.5 border-t border-dashed border-border">
                    <div className="flex items-center gap-2">
                      <div className="avatar w-[22px] h-[22px] text-[10px]">{initials(b.project_name)}</div>
                      <span className="text-xs text-text-muted">{b.project_name}</span>
                    </div>
                    <span className="text-xs text-text-muted">{formatDate(b.uploaded_at || b.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
