import { useState, useEffect } from 'react'
import Icon from './Icon'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import {
  createProject, fetchProject, fetchProjectStats, fetchProjectTeam, deleteProject, fetchProjects,
} from '../api/projects'
import { fetchUsers, createUser, fetchUser, updateUser } from '../api/users'
import {
  createBimModel, fetchBimModel, fetchBimVersions, fetchBimFeedbacks, deleteBimModel, fetchBimModels,
} from '../api/bim'
import { createQrMarker } from '../api/qr'
import { createGpsPoi } from '../api/gps'
import { fetchFeedback, updateFeedback, deleteFeedback } from '../api/feedbacks'
import { fetchElement } from '../api/misc'
import { IMG } from '../data/images'
import { initials, formatDate, formatDateTime, parseJson } from '../utils/helpers'
import { withBase } from '../utils/basePath'

function ModalOverlay({ id, activeModal, onClose, children, className = '' }) {
  return (
    <div className={`overlay ${activeModal === id ? 'on' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ModalClose({ onClose }) {
  return (
    <button type="button" className="modal-close" onClick={onClose}>
      <Icon name="x" size={14} />
    </button>
  )
}

function statusChip(status) {
  const map = {
    open: 'chip-red',
    in_progress: 'chip-yellow',
    resolved: 'chip-green',
    closed: 'chip-gray',
    pending: 'chip-yellow',
    approved: 'chip-green',
    rejected: 'chip-red',
  }
  return map[status] || 'chip-gray'
}

function ProfileModal({ activeModal, closeModal, t }) {
  const { user, logout } = useAuth()
  const { roleLabelKey } = usePermissions()

  const handleLogout = async () => {
    closeModal()
    await logout()
    window.location.href = withBase('login')
  }

  return (
    <ModalOverlay id="profile" activeModal={activeModal} onClose={closeModal} className="max-w-[420px]">
      <div className="modal-hd">
        <div><div className="modal-title">{t('profile_title')}</div></div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body text-center">
        <div className="avatar w-20 h-20 text-[28px] mx-auto mb-3">{user ? initials(user.full_name) : '?'}</div>
        <div className="font-bold text-base">{user?.full_name}</div>
        <div className="text-xs text-text-muted mb-4">{user?.email} · {t(roleLabelKey)}</div>
        <div className="text-left p-4 bg-[#F9FAFB] rounded-[10px]">
          <ul className="info-list">
            <li><span>{t('role')}</span><b>{user?.role}</b></li>
            {user?.project_ids?.length > 0 && (
              <li><span>{t('assigned_projects')}</span><b>{user.project_ids.length}</b></li>
            )}
          </ul>
        </div>
      </div>
      <div className="modal-ft">
        <div className="flex-1" />
        <button type="button" className="btn btn-d" onClick={handleLogout}>
          <Icon name="log-out" size={14} /> {t('logout')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ProjectNewModal({ activeModal, closeModal, toast, t, refreshProjects }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('active')
  const [engineerId, setEngineerId] = useState('')
  const [engineers, setEngineers] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'project-new') return
    fetchUsers({ role: 'engineer', limit: 50 })
      .then((res) => setEngineers(res.data || []))
      .catch(() => setEngineers([]))
  }, [activeModal])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await createProject({
        name: name.trim(),
        address: address.trim() || null,
        status,
        engineer_ids: engineerId ? [engineerId] : [],
      })
      refreshProjects()
      closeModal()
      toast('success', t('created'))
      setName('')
      setAddress('')
      setEngineerId('')
    } catch (err) {
      toast('err', err.message || t('err_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="project-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('pn_title')}</div>
          <div className="modal-sub">{t('pn_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row">
          <label className="form-label">{t('pn_name')} <span className="req">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">{t('pn_addr')}</label>
          <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('pn_st')}</label>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">{t('prj_st_active')}</option>
              <option value="completed">{t('prj_st_archive')}</option>
              <option value="archived">{t('prj_st_archive')}</option>
            </select>
          </div>
          <div>
            <label className="form-label">{t('pn_engineer')}</label>
            <select className="form-select" value={engineerId} onChange={(e) => setEngineerId(e.target.value)}>
              <option value="">—</option>
              {engineers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !name.trim()} onClick={handleCreate}>
          {submitting ? '...' : t('pn_create')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function QrNewModal({ activeModal, closeModal, toast, t, refreshData }) {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [markerCode, setMarkerCode] = useState('')
  const [floor, setFloor] = useState('')
  const [sizeCm, setSizeCm] = useState(20)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [z, setZ] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'qr-new') return
    fetchProjects({ limit: 50 })
      .then((r) => {
        const list = r.data || []
        setProjects(list)
        if (list[0]) setProjectId(list[0].id)
      })
      .catch(() => setProjects([]))
  }, [activeModal])

  const handleCreate = async () => {
    if (!projectId || !markerCode.trim()) return
    setSubmitting(true)
    try {
      await createQrMarker({
        project_id: projectId,
        marker_code: markerCode.trim(),
        floor_level: floor || null,
        physical_width_m: Number(sizeCm) / 100,
        bim_pos_x: Number(x) || 0,
        bim_pos_y: Number(y) || 0,
        bim_pos_z: Number(z) || 0,
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
      setMarkerCode('')
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="qr-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div><div className="modal-title">{t('qr_new')}</div></div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row">
          <label className="form-label">{t('bu_proj')} <span className="req">*</span></label>
          <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">{t('qr_code')} <span className="req">*</span></label>
          <input className="form-input font-mono" value={markerCode} onChange={(e) => setMarkerCode(e.target.value)} placeholder="PROJ001-F03-M003" />
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('qr_floor')}</label>
            <input className="form-input" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Tầng 3" />
          </div>
          <div>
            <label className="form-label">{t('qr_size')} (cm)</label>
            <input className="form-input" type="number" value={sizeCm} onChange={(e) => setSizeCm(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">{t('qr_pos')}</label>
          <div className="grid grid-cols-3 gap-3.5">
            <input className="form-input" placeholder="X" type="number" step="0.1" value={x} onChange={(e) => setX(e.target.value)} />
            <input className="form-input" placeholder="Y" type="number" step="0.1" value={y} onChange={(e) => setY(e.target.value)} />
            <input className="form-input" placeholder="Z" type="number" step="0.1" value={z} onChange={(e) => setZ(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !markerCode.trim()} onClick={handleCreate}>
          {submitting ? '...' : t('save')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function GpsNewModal({ activeModal, closeModal, toast, t, refreshData }) {
  const [models, setModels] = useState([])
  const [modelId, setModelId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('manhole')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [elevation, setElevation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'gps-new') return
    fetchBimModels({ limit: 50 })
      .then((r) => {
        const list = r.data || []
        setModels(list)
        if (list[0]) setModelId(list[0].id)
      })
      .catch(() => setModels([]))
  }, [activeModal])

  const handleCreate = async () => {
    if (!name.trim() || !lat || !lng) return
    setSubmitting(true)
    try {
      await createGpsPoi({
        model_id: modelId || null,
        name: name.trim(),
        type,
        lat_wgs84: Number(lat),
        lng_wgs84: Number(lng),
        elevation: elevation === '' ? null : Number(elevation),
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
      setName('')
      setLat('')
      setLng('')
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="gps-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div><div className="modal-title">{t('gps_new')}</div></div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('ele_bim_model')}</label>
            <select className="form-select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">—</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name || m.version}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('gps_type')} <span className="req">*</span></label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="manhole">{t('gps_manhole')}</option>
              <option value="pipe_junction">{t('gps_sub_station')}</option>
              <option value="valve">{t('gps_valve')}</option>
              <option value="cable_box">{t('gps_cable_box')}</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">{t('gps_name')} <span className="req">*</span></label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          <div>
            <label className="form-label">Lat <span className="req">*</span></label>
            <input className="form-input" type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="21.028511" />
          </div>
          <div>
            <label className="form-label">Lon <span className="req">*</span></label>
            <input className="form-input" type="number" step="0.000001" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="105.804817" />
          </div>
          <div>
            <label className="form-label">Alt (m)</label>
            <input className="form-input" type="number" step="0.1" value={elevation} onChange={(e) => setElevation(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !name.trim() || !lat || !lng} onClick={handleCreate}>
          {submitting ? '...' : t('save')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function UserNewModal({ activeModal, closeModal, toast, t, refreshData }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('engineer')
  const [language, setLanguage] = useState('vi')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password) return
    setSubmitting(true)
    try {
      await createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        language,
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
      setFullName('')
      setEmail('')
      setPassword('')
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="user-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div><div className="modal-title">{t('user_new')}</div></div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('user_col_user')} <span className="req">*</span></label>
            <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Email <span className="req">*</span></label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">Password <span className="req">*</span></label>
          <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('user_col_role')} <span className="req">*</span></label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="engineer">{t('user_role_eng')}</option>
              <option value="bql">{t('user_role_bql')}</option>
              <option value="admin">{t('user_role_admin')}</option>
            </select>
          </div>
          <div>
            <label className="form-label">{t('set_lang_sys')}</label>
            <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="vi">{t('lang_vi')}</option>
              <option value="en">{t('lang_en')}</option>
              <option value="ja">{t('lang_ja')}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !fullName.trim() || !email.trim() || !password} onClick={handleCreate}>
          {submitting ? '...' : t('user_new')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function UserEditModal({ activeModal, modalData, closeModal, toast, t, refreshData }) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('engineer')
  const [language, setLanguage] = useState('vi')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const userId = modalData?.id

  useEffect(() => {
    if (activeModal !== 'user-edit' || !userId) return
    setLoading(true)
    fetchUser(userId)
      .then((u) => {
        setFullName(u.full_name || '')
        setRole(u.role || 'engineer')
        setLanguage(u.language || 'vi')
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, userId, toast])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      await updateUser(userId, { full_name: fullName.trim(), role, language })
      refreshData()
      closeModal()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="user-edit" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div><div className="modal-title">{t('edit')}</div></div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="text-center py-6 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <div className="form-row">
              <label className="form-label">{t('user_col_user')}</label>
              <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('user_col_role')}</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="engineer">{t('user_role_eng')}</option>
                  <option value="bql">{t('user_role_bql')}</option>
                  <option value="admin">{t('user_role_admin')}</option>
                </select>
              </div>
              <div>
                <label className="form-label">{t('set_lang_sys')}</label>
                <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="vi">{t('lang_vi')}</option>
                  <option value="en">{t('lang_en')}</option>
                  <option value="ja">{t('lang_ja')}</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || loading} onClick={handleSave}>
          {submitting ? '...' : t('save')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ElementDetailModal({ activeModal, modalData, closeModal, openModal, toast, t }) {
  const [el, setEl] = useState(null)
  const [loading, setLoading] = useState(false)
  const guid = modalData?.id

  useEffect(() => {
    if (activeModal !== 'element-detail' || !guid) return
    setLoading(true)
    fetchElement(guid)
      .then(setEl)
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, guid, toast])

  return (
    <ModalOverlay id="element-detail" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('ele_code')}</div>
          <div className="modal-sub font-mono">{el?.id || guid || '...'}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading || !el ? (
          <div className="text-center py-6 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <ul className="info-list">
              <li><span>{t('ele_name')}</span><b>{el.name}</b></li>
              <li><span>{t('ele_cat')}</span><b>{t(`ele_${el.cat}`) || el.cat}</b></li>
              <li><span>{t('ele_maker')}</span><b>{el.maker}</b></li>
              <li>
                <span>{t('ele_bim_model')}</span>
                <b>
                  {el.model_id ? (
                    <button
                      type="button"
                      className="text-primary cursor-pointer bg-transparent border-none p-0"
                      onClick={() => { closeModal(); openModal('bim-detail', { id: el.model_id }) }}
                    >
                      {el.bim}
                    </button>
                  ) : el.bim}
                </b>
              </li>
              <li>
                <span>{t('status')}</span>
                <b>
                  <span className={`chip ${el.status === 'active' ? 'chip-green' : 'chip-yellow'}`}>
                    <span className="dot" />{t(`ele_st_${el.status === 'active' ? 'active' : 'maint'}`)}
                  </span>
                </b>
              </li>
              <li><span>{t('ele_fb')}</span><b><span className="chip chip-red">{el.fb}</span></b></li>
            </ul>
            {el.feedbacks?.length > 0 && (
              <div className="mt-4">
                <div className="card-sub mb-2 font-semibold">{t('nav_feedback')}</div>
                {el.feedbacks.slice(0, 5).map((f) => (
                  <div key={f.id} className="py-2 border-b border-dashed border-border text-[13px]">
                    <div className="font-semibold">{f.title || f.content?.slice(0, 60)}</div>
                    <div className="text-xs text-text-muted">{f.user_name} · {formatDate(f.created_at)} · {f.status}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
      </div>
    </ModalOverlay>
  )
}

function BimUploadModal({ activeModal, closeModal, toast, t, refreshData }) {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [discipline, setDiscipline] = useState('architecture')
  const [desc, setDesc] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'bim-upload') return
    fetchProjects({ limit: 50 })
      .then((r) => {
        const list = r.data || []
        setProjects(list)
        if (list[0]) setProjectId(list[0].id)
      })
      .catch(() => setProjects([]))
  }, [activeModal])

  const handleCreate = async () => {
    if (!projectId || !version.trim()) return
    setSubmitting(true)
    try {
      await createBimModel({
        project_id: projectId,
        name: name.trim() || null,
        version: version.trim(),
        discipline,
        model_files: fileUrl ? { url: fileUrl } : null,
        metadata: desc ? { description: desc } : null,
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
      setName('')
      setVersion('v1.0')
      setDesc('')
      setFileUrl('')
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="bim-upload" activeModal={activeModal} onClose={closeModal} className="lg">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('bu_title')}</div>
          <div className="modal-sub">{t('bu_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('bu_proj')} <span className="req">*</span></label>
            <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('bu_type')} <span className="req">*</span></label>
            <select className="form-select" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="architecture">{t('bim_indoor')}</option>
              <option value="structural">{t('bim_outdoor')}</option>
              <option value="mep">MEP</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('bu_name')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tòa A – F4" />
          </div>
          <div>
            <label className="form-label">{t('bu_ver')} <span className="req">*</span></label>
            <input className="form-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0" />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">{t('bu_desc')}</label>
          <textarea className="form-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('bu_desc_ph')} />
        </div>
        <div className="form-row">
          <label className="form-label">{t('bu_bundle')} (URL)</label>
          <input className="form-input" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
          <div className="text-xs text-text-muted mt-1">{t('bu_bundle_hint')}</div>
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !projectId || !version.trim()} onClick={handleCreate}>
          <Icon name="upload" size={14} /> {submitting ? '...' : 'Upload'}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ProjectModal({ activeModal, modalData, closeModal, toast, t, refreshProjects }) {
  const { canManageProjects } = usePermissions()
  const [tab, setTab] = useState('info')
  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(false)
  const projectId = modalData?.id

  useEffect(() => {
    if (activeModal !== 'project' || !projectId) return
    setLoading(true)
    setTab('info')
    Promise.all([
      fetchProject(projectId),
      fetchProjectStats(projectId),
      fetchProjectTeam(projectId),
    ])
      .then(([p, s, teamRes]) => {
        setProject(p)
        setStats(s)
        setTeam(teamRes.data || [])
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, projectId, toast])

  const handleDelete = async () => {
    if (!projectId || !window.confirm('Xóa dự án này?')) return
    try {
      await deleteProject(projectId)
      refreshProjects()
      closeModal()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  return (
    <ModalOverlay id="project" activeModal={activeModal} onClose={closeModal} className="lg">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{project?.name || '...'}</div>
          <div className="modal-sub">{project?.status}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-4">
              {[
                { lbl: t('nav_bim'), val: stats?.bim_models ?? 0, icon: 'cube', cls: 'purple' },
                { lbl: t('nav_qr'), val: stats?.qr_markers ?? 0, icon: 'qr', cls: 'green' },
                { lbl: t('nav_gps'), val: stats?.gps_pois ?? 0, icon: 'map-pin', cls: 'orange' },
                { lbl: t('dash_st4'), val: stats?.open_feedbacks ?? 0, icon: 'chat', cls: 'red', color: 'text-danger' },
              ].map((s) => (
                <div key={s.lbl} className="stat">
                  <div className="stat-info"><div className="lbl">{s.lbl}</div><div className={`val ${s.color || ''}`}>{s.val}</div></div>
                  <div className={`stat-icon ${s.cls}`}><Icon name={s.icon} size={22} /></div>
                </div>
              ))}
            </div>
            <div className="tabs">
              {['info', 'team'].map((k) => (
                <button key={k} type="button" className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                  {k === 'team' ? 'Team' : 'Info'}
                </button>
              ))}
            </div>
            {tab === 'info' && project && (
              <ul className="info-list">
                <li><span>{t('pn_name')}</span><b>{project.name}</b></li>
                <li><span>{t('pn_addr')}</span><b>{project.address || '—'}</b></li>
                <li><span>{t('status')}</span><b>{project.status}</b></li>
                <li><span>{t('pn_start')}</span><b>{formatDate(project.created_at)}</b></li>
              </ul>
            )}
            {tab === 'team' && team.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-dashed border-border">
                <div className="avatar">{initials(u.full_name)}</div>
                <div className="flex-1">
                  <div className="font-semibold">{u.full_name}</div>
                  <div className="text-xs text-text-muted">{u.email} · {u.role}</div>
                </div>
              </div>
            ))}
            {tab === 'team' && team.length === 0 && (
              <div className="text-sm text-text-muted py-4">{t('empty_members')}</div>
            )}
          </>
        )}
      </div>
      <div className="modal-ft">
        {canManageProjects && (
          <button type="button" className="btn btn-d" onClick={handleDelete}>
            <Icon name="trash" size={14} /> {t('delete')}
          </button>
        )}
        <div className="flex-1" />
        <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
      </div>
    </ModalOverlay>
  )
}

function FeedbackModal({ activeModal, modalData, closeModal, toast, t, refreshData }) {
  const [fb, setFb] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('open')
  const [saving, setSaving] = useState(false)
  const fbId = modalData?.id
  const images = parseJson(fb?.images, []) || []

  useEffect(() => {
    if (activeModal !== 'feedback' || !fbId) return
    setLoading(true)
    fetchFeedback(fbId)
      .then((data) => {
        setFb(data)
        setStatus(data.status || 'open')
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, fbId, toast])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateFeedback(fbId, { status })
      setFb(updated)
      refreshData()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async () => {
    setStatus('resolved')
    try {
      await updateFeedback(fbId, { status: 'resolved' })
      refreshData()
      toast('success', t('saved'))
      closeModal()
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Xóa phản hồi này?')) return
    try {
      await deleteFeedback(fbId)
      refreshData()
      closeModal()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  return (
    <ModalOverlay id="feedback" activeModal={activeModal} onClose={closeModal} className="lg">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{fb?.title || '...'}</div>
          <div className="modal-sub">{fb?.id} · {fb?.user_name} · {formatDateTime(fb?.created_at)}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading || !fb ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
            <div>
              <div className="card-sub mb-2 font-semibold">📷 {t('bd_photo')}</div>
              <div className="aspect-[4/3] bg-border-light rounded-[10px] overflow-hidden mb-2 border border-border">
                <img src={images[0] || IMG.fb[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="card mt-4 p-3.5 mb-0 bg-[#F9FAFB]">
                <div className="card-sub mb-2 font-semibold">📍 Vị trí</div>
                <ul className="info-list">
                  <li><span>Type</span><b>{fb.location_type || '—'}</b></li>
                  <li><span>GPS</span><b className="font-mono text-xs">{fb.lat != null ? `${fb.lat}, ${fb.lng}` : '—'}</b></li>
                  <li><span>QR</span><b className="font-mono text-xs">{fb.marker_id || '—'}</b></li>
                  <li><span>{t('ele_code')}</span><b className="font-mono text-xs">{fb.element_guid || '—'}</b></li>
                </ul>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
                <span className={`chip ${statusChip(status)} text-xs px-3 py-1.5`}>{status}</span>
                <div className="flex gap-2">
                  <select className="form-select w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                  <button type="button" className="btn btn-sm btn-s" onClick={handleResolve}>
                    <Icon name="check" size={12} /> {t('st_resolved')}
                  </button>
                </div>
              </div>
              <div className="card p-3.5 mb-3">
                <div className="card-sub mb-2 font-semibold">{t('bd_desc')}</div>
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{fb.content}</div>
              </div>
              <div className="card p-3.5">
                <ul className="info-list">
                  <li><span>Priority</span><b>{fb.priority}</b></li>
                  <li><span>Reporter</span><b>{fb.user_name}</b></li>
                  <li><span>Email</span><b className="text-xs">{fb.user_email}</b></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn btn-d" onClick={handleDelete}><Icon name="trash" size={14} /> {t('delete')}</button>
        <div className="flex-1" />
        <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
        <button type="button" className="btn btn-p" disabled={saving || loading} onClick={handleSave}>
          {saving ? '...' : t('save')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function BimDetailModal({ activeModal, modalData, closeModal, openModal, toast, t, refreshData }) {
  const [bim, setBim] = useState(null)
  const [versions, setVersions] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [tab, setTab] = useState('preview')
  const [loading, setLoading] = useState(false)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const bimId = modalData?.id
  const gallery = IMG.bimDetail
  const meta = parseJson(bim?.metadata, {}) || {}

  useEffect(() => {
    if (activeModal !== 'bim-detail' || !bimId) return
    setLoading(true)
    setTab('preview')
    setGalleryIdx(0)
    Promise.all([
      fetchBimModel(bimId),
      fetchBimVersions(bimId, { limit: 20 }).catch(() => ({ data: [] })),
      fetchBimFeedbacks(bimId, { limit: 20 }).catch(() => ({ data: [] })),
    ])
      .then(([model, ver, fb]) => {
        setBim(model)
        setVersions(ver.data || [])
        setFeedbacks(fb.data || [])
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, bimId, toast])

  const handleDelete = async () => {
    if (!window.confirm('Xóa mô hình BIM này?')) return
    try {
      await deleteBimModel(bimId)
      refreshData()
      closeModal()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  return (
    <ModalOverlay id="bim-detail" activeModal={activeModal} onClose={closeModal} className="xl">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{bim?.name || '...'}</div>
          <div className="modal-sub">
            {bim?.project_name} · {bim?.version} · {bim?.discipline} · {formatDate(bim?.uploaded_at || bim?.created_at)}
          </div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading || !bim ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <div className="tabs">
              {[
                { k: 'preview', label: `🖼 ${t('bd_tab_preview')}` },
                { k: 'feedback', label: `💬 ${t('bd_tab_feedback')} (${feedbacks.length})` },
                { k: 'versions', label: `📚 ${t('bd_tab_versions')}` },
              ].map(({ k, label }) => (
                <button key={k} type="button" className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>

            {tab === 'preview' && (
              <div className="grid grid-cols-[1.2fr_1fr] gap-6 max-[900px]:grid-cols-1">
                <div>
                  <div className="card-sub mb-2 font-semibold">{t('bd_preview_note')}</div>
                  <div className="relative aspect-[16/10] bg-border-light rounded-[10px] overflow-hidden border border-border mb-2.5">
                    <img src={gallery[galleryIdx]} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute top-2.5 right-2.5 bg-black/70 text-white px-2.5 py-1 rounded-md text-[11px] backdrop-blur-sm">
                      {galleryIdx + 1} / {gallery.length}
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {gallery.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`aspect-square bg-border-light rounded-md overflow-hidden cursor-pointer border-2 p-0 ${galleryIdx === i ? 'border-primary' : 'border-transparent'}`}
                        onClick={() => setGalleryIdx(i)}
                      >
                        <img src={IMG.bimThumb[i] || src} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="card-sub mb-2 font-semibold">{t('bd_info')}</div>
                  <ul className="info-list">
                    <li><span>{t('bd_proj')}</span><b>{bim.project_name}</b></li>
                    <li><span>{t('bd_ver')}</span><b>{bim.version}</b></li>
                    <li><span>{t('bd_type')}</span><b>{bim.discipline}</b></li>
                    <li><span>{t('bd_date')}</span><b>{formatDateTime(bim.uploaded_at || bim.created_at)}</b></li>
                  </ul>
                  {meta.description && (
                    <div className="mt-4">
                      <div className="card-sub mb-2 font-semibold">{t('bd_desc')}</div>
                      <div className="p-3 bg-[#F9FAFB] rounded-lg text-[13px] leading-relaxed">{meta.description}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'feedback' && (
              <div>
                {feedbacks.length === 0 ? (
                  <div className="text-sm text-text-muted py-4">{t('empty_feedback')}</div>
                ) : feedbacks.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 py-2.5 border-b border-dashed border-border cursor-pointer hover:bg-[#F9FAFB]"
                    onClick={() => { closeModal(); openModal('feedback', { id: f.id }) }}
                    onKeyDown={(e) => e.key === 'Enter' && (closeModal(), openModal('feedback', { id: f.id }))}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="avatar">{initials(f.user_name)}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-[13px]">{f.title || f.content?.slice(0, 80)}</div>
                      <div className="text-xs text-text-muted">{f.user_name} · {formatDate(f.created_at)}</div>
                    </div>
                    <span className={`chip ${statusChip(f.status)}`}>{f.status}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'versions' && (
              <div>
                {versions.length === 0 ? (
                  <div className="text-sm text-text-muted py-4">{t('empty_versions')}</div>
                ) : versions.map((v) => (
                  <div key={v.id} className="flex gap-3.5 py-3">
                    <div className="w-8 h-8 bg-primary-light text-primary-dark rounded-full flex items-center justify-center shrink-0 border-[3px] border-white">
                      <Icon name="cube" size={14} />
                    </div>
                    <div className="flex-1 bg-[#F9FAFB] border border-border rounded-[10px] p-3">
                      <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                        <div className="font-semibold text-[13px] flex items-center gap-2">
                          <b>{v.version}</b>
                          {v.id === bim.id && <span className="chip chip-green">{t('bim_active')}</span>}
                        </div>
                        <div className="text-[11px] text-text-muted">{formatDate(v.uploaded_at || v.created_at)}</div>
                      </div>
                      <div className="text-[13px]">{v.name || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn btn-d" onClick={handleDelete}><Icon name="trash" size={14} /> {t('delete')}</button>
        <div className="flex-1" />
        <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
      </div>
    </ModalOverlay>
  )
}

export default function Modals() {
  const { activeModal, modalData, closeModal, openModal, toast, refreshProjects, refreshData } = useApp()
  const { t } = useI18n()

  return (
    <>
      <ProfileModal activeModal={activeModal} closeModal={closeModal} t={t} />
      <ProjectNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshProjects={refreshProjects} />
      <QrNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <GpsNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <UserNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <UserEditModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <ElementDetailModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} openModal={openModal} toast={toast} t={t} />
      <BimUploadModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <ProjectModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshProjects={refreshProjects} />
      <FeedbackModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <BimDetailModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} openModal={openModal} toast={toast} t={t} refreshData={refreshData} />
    </>
  )
}
