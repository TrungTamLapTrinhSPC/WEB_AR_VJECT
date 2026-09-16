import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchProjects } from '../api/projects'
import { fetchBimModels } from '../api/bim'
import SearchPickerField from './SearchPickerField'

export default function FeedbackProjectModelFields({
  t,
  projectId,
  projectLabel,
  modelId,
  modelLabel,
  onProjectChange,
  onModelChange,
  disabled = false,
}) {
  const [projectQuery, setProjectQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [projects, setProjects] = useState([])
  const [models, setModels] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  const loadProjects = useCallback(async (search) => {
    setLoadingProjects(true)
    try {
      const r = await fetchProjects({ limit: 30, search: search || undefined })
      setProjects(r.data || [])
    } catch {
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const loadModels = useCallback(async (pid, search) => {
    if (!pid) {
      setModels([])
      return
    }
    setLoadingModels(true)
    try {
      const r = await fetchBimModels({
        project_id: pid,
        limit: 30,
        search: search || undefined,
      })
      setModels(r.data || [])
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    const tmr = setTimeout(() => loadProjects(projectQuery), projectQuery ? 280 : 0)
    return () => clearTimeout(tmr)
  }, [projectQuery, loadProjects])

  useEffect(() => {
    if (!projectId) {
      setModels([])
      return undefined
    }
    const tmr = setTimeout(() => loadModels(projectId, modelQuery), modelQuery ? 280 : 0)
    return () => clearTimeout(tmr)
  }, [projectId, modelQuery, loadModels])

  const projectOptions = useMemo(
    () => projects.map((p) => ({
      id: p.id,
      label: p.name,
      hint: p.address || undefined,
    })),
    [projects],
  )

  const modelOptions = useMemo(
    () => models.map((m) => ({
      id: m.id,
      label: m.name,
      hint: `v${m.version}${m.discipline ? ` · ${m.discipline}` : ''}`,
    })),
    [models],
  )

  return (
    <div className="form-row-grid">
      <SearchPickerField
        label={t('fb_field_project')}
        placeholder={t('prj_search')}
        noneLabel={t('fb_field_project_none')}
        value={projectId}
        selectedLabel={projectLabel}
        options={projectOptions}
        loading={loadingProjects}
        disabled={disabled}
        onQueryChange={setProjectQuery}
        emptyMessage={t('search_no_results')}
        onChange={(id, opt) => {
          onProjectChange(id, opt?.label || '')
        }}
      />
      <SearchPickerField
        label={t('fb_field_model')}
        placeholder={t('bim_search')}
        noneLabel={t('fb_field_model_none')}
        value={modelId}
        selectedLabel={modelLabel}
        options={modelOptions}
        loading={loadingModels}
        disabled={disabled || !projectId}
        onQueryChange={setModelQuery}
        emptyMessage={t('search_no_results')}
        onChange={(id, opt) => {
          onModelChange(id, opt?.label || '')
        }}
      />
    </div>
  )
}
