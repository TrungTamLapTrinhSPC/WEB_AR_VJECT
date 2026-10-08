import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Icon from './Icon'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import {
  createProject, fetchProject, fetchProjects, fetchProjectStats, fetchProjectTeam, deleteProject,
  assignEngineer, removeTeamMember, assignProjectGroup, removeProjectGroup,
  assignProjectAttributeGroup, removeProjectAttributeGroup,
} from '../api/projects'
import { fetchCompanyGroups, fetchCompanyGroup, createCompanyGroup, updateCompanyGroup } from '../api/companyGroups'
import { fetchProjectAttributeGroups } from '../api/projectAttributeGroups'
import CompanyGroupAssign from './CompanyGroupAssign'
import CompanyGroupField from './CompanyGroupField'
import S3Image from './S3Image'
import FeedbackImagesField from './FeedbackImagesField'
import FeedbackProjectModelFields from './FeedbackProjectModelFields'
import { openS3Url } from '../api/uploads'
import { fetchUsers, createUser, fetchUser, updateUser, deleteUser, setUserPassword } from '../api/users'
import {
  uploadIfcBimModel, fetchBimModel, fetchBimVersions, fetchBimFeedbacks, deleteBimModel, fetchBimModels, updateBimModel,
} from '../api/bim'
import {
  createQrMarker, fetchQrMarker, updateQrMarker, fetchQrMarkerImageBlob, generateQrMarkerImage,
  downloadQrMarkerPng, openQrMarkerInNewTab,
} from '../api/qr'
import { fetchGpsPois, createGpsPoi, fetchGpsPoi, updateGpsPoi } from '../api/gps'
import { fetchQrMarkers } from '../api/qr'
import {
  fetchFeedback, fetchFeedbacks, createFeedback, updateFeedback, deleteFeedback,
  fetchFeedbackComments, postFeedbackComment,
} from '../api/feedbacks'
import { fetchElement, updateElementStyle } from '../api/misc'
import { IMG } from '../data/images'
import { initials, formatDate, formatDateTime, parseJson } from '../utils/helpers'
import { getBimPreviewUrls } from '../utils/bimPreview'
import { disciplineLabel } from '../utils/disciplineLabel'
import { elementBimLabel } from '../utils/elementBim'
import DisciplineSelect from './DisciplineSelect'
import UploadDonut from './UploadDonut'
import { withBase } from '../utils/basePath'
import { fetchPasswordPolicy, changePassword } from '../api/auth'
import PasswordInput from './PasswordInput'
import PasswordRequirements from './PasswordRequirements'
import { formatRuleLabel, getRuleChecks, isPasswordStrong } from '../utils/passwordPolicy'

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

function ProfileModal({ activeModal, closeModal, t, toast }) {
  const { user, logout } = useAuth()
  const { roleLabelKey } = usePermissions()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  useEffect(() => {
    if (activeModal !== 'profile') {
      setCurrentPassword('')
      setNewPassword('')
    }
  }, [activeModal])

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return
    setChangingPwd(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      toast('success', t('profile_pwd_changed'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setChangingPwd(false)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm(t('logout_confirm'))) return
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
        <div className="mt-4 text-left p-4 bg-[#F9FAFB] rounded-[10px]">
          <div className="font-semibold text-sm mb-2">{t('profile_change_pwd')}</div>
          <div className="form-row">
            <label className="form-label">{t('profile_current_pwd')}</label>
            <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="form-row mb-2">
            <label className="form-label">{t('profile_new_pwd')}</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="button" className="btn btn-p w-full" disabled={changingPwd || !currentPassword || !newPassword} onClick={handleChangePassword}>
            {changingPwd ? '...' : t('profile_change_pwd_btn')}
          </button>
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

const QR_PAPER_SIZES = ['A4', 'A3', 'A2', 'A1', 'A0']

function qrFormNum(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function qrDaysFromExpires(expiresAt) {
  if (!expiresAt) return '30'
  const ms = new Date(expiresAt).getTime() - Date.now()
  return String(Math.max(1, Math.ceil(ms / 86400000)))
}

function formatQrExpires(expiresAt, t) {
  if (!expiresAt) return '—'
  const d = new Date(expiresAt)
  if (Number.isNaN(d.getTime())) return '—'
  const expired = d.getTime() < Date.now()
  return `${formatDateTime(expiresAt)}${expired ? ` (${t('qr_expired')})` : ''}`
}

function qrMarkerPayload(form, validDays) {
  const payload = {
    marker_type: form.markerType,
    floor_level: form.floor || null,
    physical_width_m: qrFormNum(form.sizeCm, 20) / 100,
    bim_pos_x: qrFormNum(form.x, 0),
    bim_pos_y: qrFormNum(form.y, 0),
    bim_pos_z: qrFormNum(form.z, 0),
    paper_size: form.paperSize,
    tabletop_scale: qrFormNum(form.tabletopScale, 0.01),
    offset_to_center_x: qrFormNum(form.offsetX, 0.15),
    offset_to_center_z: qrFormNum(form.offsetZ, -0.10),
    paper_rotation_y: qrFormNum(form.paperRotY, 0),
  }
  if (validDays != null && validDays !== '') {
    payload.valid_days = Number(validDays) || 30
  }
  return payload
}

function QrValidityFields({ validDays, setValidDays, expiresAt, t, readOnly = false }) {
  return (
    <div className="form-row">
      <label className="form-label">{t('qr_valid_days')}</label>
      {readOnly ? (
        <div className="text-sm">{formatQrExpires(expiresAt, t)}</div>
      ) : (
        <>
          <input
            className="form-input"
            type="number"
            min={1}
            max={3650}
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
          <div className="text-xs text-text-muted mt-1">{t('qr_valid_days_hint')}</div>
          {expiresAt ? (
            <div className="text-xs text-text-muted mt-1">{t('qr_expires_current')}: {formatQrExpires(expiresAt, t)}</div>
          ) : null}
        </>
      )}
    </div>
  )
}

function QrMarkerConfigFields({ t, form, set }) {
  const isTabletop = form.markerType === 'tabletop'
  return (
    <>
      <div className="form-row">
        <label className="form-label">{t('qr_marker_type')}</label>
        <select className="form-select" value={form.markerType} onChange={(e) => set('markerType', e.target.value)}>
          <option value="field">{t('qr_type_field')}</option>
          <option value="tabletop">{t('qr_type_tabletop')}</option>
        </select>
        <p className="text-xs text-text-muted mt-1.5">{isTabletop ? t('qr_type_tabletop_hint') : t('qr_type_field_hint')}</p>
      </div>
      <div className="form-row-grid">
        <div>
          <label className="form-label">{t('qr_floor')}</label>
          <input className="form-input" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="Tầng 3" />
        </div>
        <div>
          <label className="form-label">{t('qr_size')} (cm)</label>
          <input className="form-input" type="number" value={form.sizeCm} onChange={(e) => set('sizeCm', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">{t('qr_pos')}</label>
        <div className="grid grid-cols-3 gap-3.5">
          <input className="form-input" placeholder="X" type="number" step="0.1" value={form.x} onChange={(e) => set('x', e.target.value)} />
          <input className="form-input" placeholder="Y" type="number" step="0.1" value={form.y} onChange={(e) => set('y', e.target.value)} />
          <input className="form-input" placeholder="Z" type="number" step="0.1" value={form.z} onChange={(e) => set('z', e.target.value)} />
        </div>
      </div>
      <div className={`card p-3.5 mb-0 bg-[#F9FAFB] ${isTabletop ? '' : 'opacity-60'}`}>
        <div className="card-sub mb-3 font-semibold">{t('qr_tabletop_section')}</div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('qr_paper_size')}</label>
            <select className="form-select" value={form.paperSize} disabled={!isTabletop} onChange={(e) => set('paperSize', e.target.value)}>
              {QR_PAPER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('qr_tabletop_scale')}</label>
            <input className="form-input" type="number" step="0.001" disabled={!isTabletop} value={form.tabletopScale} onChange={(e) => set('tabletopScale', e.target.value)} />
          </div>
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('qr_offset_x')}</label>
            <input className="form-input" type="number" step="0.01" disabled={!isTabletop} value={form.offsetX} onChange={(e) => set('offsetX', e.target.value)} />
          </div>
          <div>
            <label className="form-label">{t('qr_offset_z')}</label>
            <input className="form-input" type="number" step="0.01" disabled={!isTabletop} value={form.offsetZ} onChange={(e) => set('offsetZ', e.target.value)} />
          </div>
        </div>
        <div className="form-row mb-0">
          <label className="form-label">{t('qr_paper_rot_y')}</label>
          <input className="form-input" type="number" step="1" disabled={!isTabletop} value={form.paperRotY} onChange={(e) => set('paperRotY', e.target.value)} />
        </div>
      </div>
    </>
  )
}

const QR_FORM_DEFAULTS = {
  markerType: 'field',
  floor: '',
  sizeCm: 20,
  x: 0,
  y: 0,
  z: 0,
  paperSize: 'A3',
  tabletopScale: 0.01,
  offsetX: 0.15,
  offsetZ: -0.10,
  paperRotY: 0,
}

function useQrFormState() {
  const [form, setForm] = useState(QR_FORM_DEFAULTS)
  const set = useCallback((key, value) => setForm((prev) => ({ ...prev, [key]: value })), [])
  const reset = useCallback(() => setForm({ ...QR_FORM_DEFAULTS }), [])
  const loadFromMarker = useCallback((m) => setForm({
    markerType: m.marker_type || 'field',
    floor: m.floor_level || '',
    sizeCm: m.physical_width_m ? Math.round(m.physical_width_m * 100) : 20,
    x: m.bim_pos_x ?? 0,
    y: m.bim_pos_y ?? 0,
    z: m.bim_pos_z ?? 0,
    paperSize: m.paper_size || 'A3',
    tabletopScale: m.tabletop_scale ?? 0.01,
    offsetX: m.offset_to_center_x ?? 0.15,
    offsetZ: m.offset_to_center_z ?? -0.10,
    paperRotY: m.paper_rotation_y ?? 0,
  }), [])
  return { form, set, reset, loadFromMarker }
}

function QrNewModal({ activeModal, modalData, closeModal, toast, t, refreshData, refreshProjects, openModal }) {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [markerCode, setMarkerCode] = useState('')
  const [validDays, setValidDays] = useState('30')
  const { form, set, reset } = useQrFormState()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'qr-new') return
    reset()
    setMarkerCode('')
    setValidDays('30')
    fetchProjects({ limit: 50 })
      .then((r) => {
        const list = r.data || []
        setProjects(list)
        const preset = modalData?.project_id
        if (preset && list.some((p) => p.id === preset)) setProjectId(preset)
        else if (list[0]) setProjectId(list[0].id)
      })
      .catch(() => setProjects([]))
  }, [activeModal, reset, modalData?.project_id])

  const handleCreate = async () => {
    if (!projectId || !markerCode.trim()) return
    setSubmitting(true)
    try {
      const created = await createQrMarker({
        project_id: projectId,
        marker_code: markerCode.trim(),
        valid_days: Number(validDays) || 30,
        ...qrMarkerPayload(form),
      })
      refreshData()
      refreshProjects?.()
      closeModal()
      toast('success', t('created'))
      if (created?.id) {
        openModal('qr-view', { id: created.id, marker_code: created.marker_code })
      }
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="qr-new" activeModal={activeModal} onClose={closeModal} className="lg">
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
        <QrValidityFields validDays={validDays} setValidDays={setValidDays} t={t} />
        <QrMarkerConfigFields t={t} form={form} set={set} />
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

function QrImagePreview({ markerId, markerCode, qrImageUrl, t, toast, onRegenerated }) {
  const [src, setSrc] = useState(null)
  const [loadingImg, setLoadingImg] = useState(true)
  const [imgKey, setImgKey] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!markerId) return undefined
    let objectUrl
    let cancelled = false
    setLoadingImg(true)
    fetchQrMarkerImageBlob(markerId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return objectUrl
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingImg(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [markerId, imgKey])

  const downloadPng = async () => {
    try {
      await downloadQrMarkerPng(markerId, markerCode)
    } catch (err) {
      toast('err', err.message)
    }
  }

  const openTab = async () => {
    try {
      await openQrMarkerInNewTab(markerId)
    } catch (err) {
      toast('err', err.message)
    }
  }

  const regenerate = async () => {
    setBusy(true)
    try {
      const updated = await generateQrMarkerImage(markerId)
      onRegenerated?.(updated)
      setImgKey((k) => k + 1)
      toast('success', t('qr_regenerated'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="form-row mb-4 pb-4 border-b border-border">
      <label className="form-label">{t('qr_preview')}</label>
      <div className="flex flex-wrap items-start gap-4 mt-2">
        <div className="w-44 h-44 shrink-0 border border-border bg-white rounded-lg flex items-center justify-center p-2">
          {loadingImg && !src ? (
            <span className="text-sm text-text-muted">{t('loading')}</span>
          ) : src ? (
            <img src={src} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-p" disabled={!markerId || loadingImg} onClick={downloadPng}>
            <Icon name="download" size={14} /> {t('qr_download')}
          </button>
          <button type="button" className="btn" disabled={!markerId || loadingImg} onClick={openTab}>
            <Icon name="eye" size={14} /> {t('qr_open_tab')}
          </button>
          <button type="button" className="btn" disabled={!markerId || busy} onClick={regenerate}>
            {busy ? '...' : t('qr_regenerate')}
          </button>
          {qrImageUrl ? (
            <a className="text-sm text-accent hover:underline break-all" href={qrImageUrl} target="_blank" rel="noreferrer">
              {t('qr_s3_link')}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function QrViewModal({ activeModal, modalData, closeModal, toast, t, openModal }) {
  const qrId = modalData?.id
  const [marker, setMarker] = useState(null)
  const [loading, setLoading] = useState(false)
  const [src, setSrc] = useState(null)
  const [loadingImg, setLoadingImg] = useState(true)
  const { isAdmin, isBql } = usePermissions()
  const canEditQr = isAdmin || isBql

  useEffect(() => {
    if (activeModal !== 'qr-view' || !qrId) return
    setLoading(true)
    fetchQrMarker(qrId)
      .then(setMarker)
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, qrId, toast])

  useEffect(() => {
    if (activeModal !== 'qr-view' || !qrId) return undefined
    let objectUrl
    let cancelled = false
    setLoadingImg(true)
    setSrc(null)
    fetchQrMarkerImageBlob(qrId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch((err) => toast('err', err.message))
      .finally(() => {
        if (!cancelled) setLoadingImg(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activeModal, qrId, toast])

  const code = marker?.marker_code || modalData?.marker_code || qrId

  return (
    <ModalOverlay id="qr-view" activeModal={activeModal} onClose={closeModal} className="md">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('qr_view')}</div>
          <div className="modal-sub font-mono">{code}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body text-center">
        {loading ? (
          <div className="py-10 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            {marker?.project_name ? (
              <p className="text-sm text-text-muted mb-4">{marker.project_name}</p>
            ) : null}
            <div className="inline-flex items-center justify-center p-4 bg-white border border-border rounded-xl min-h-[280px] min-w-[280px]">
              {loadingImg && !src ? (
                <span className="text-text-muted">{t('loading')}</span>
              ) : src ? (
                <img src={src} alt={code} className="max-w-[min(100%,320px)] max-h-[320px] w-auto h-auto" />
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-4 font-mono break-all">{code}</p>
            {marker?.expires_at ? (
              <p className="text-sm text-text-muted mt-3">
                {t('qr_expires_label')}: {formatQrExpires(marker.expires_at, t)}
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="modal-ft flex-wrap gap-2">
        <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
        <button
          type="button"
          className="btn"
          disabled={!qrId || loadingImg}
          onClick={() => openQrMarkerInNewTab(qrId).catch((err) => toast('err', err.message))}
        >
          <Icon name="eye" size={14} /> {t('qr_open_tab')}
        </button>
        <button
          type="button"
          className="btn btn-p"
          disabled={!qrId || loadingImg}
          onClick={() => downloadQrMarkerPng(qrId, code).catch((err) => toast('err', err.message))}
        >
          <Icon name="download" size={14} /> {t('qr_download')}
        </button>
        {canEditQr && qrId ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              closeModal()
              openModal('qr-edit', { id: qrId })
            }}
          >
            <Icon name="edit" size={14} /> {t('qr_edit')}
          </button>
        ) : null}
      </div>
    </ModalOverlay>
  )
}

function QrEditModal({ activeModal, modalData, closeModal, toast, t, refreshData }) {
  const qrId = modalData?.id
  const [marker, setMarker] = useState(null)
  const [loading, setLoading] = useState(false)
  const { form, set, loadFromMarker } = useQrFormState()
  const [validDays, setValidDays] = useState('30')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'qr-edit' || !qrId) return
    setLoading(true)
    fetchQrMarker(qrId)
      .then((data) => {
        setMarker(data)
        loadFromMarker(data)
        setValidDays(qrDaysFromExpires(data.expires_at))
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, qrId, toast, loadFromMarker])

  const handleSave = async () => {
    if (!qrId) return
    setSubmitting(true)
    try {
      const updated = await updateQrMarker(qrId, qrMarkerPayload(form, validDays))
      setMarker(updated)
      refreshData()
      toast('success', t('saved'))
      closeModal()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="qr-edit" activeModal={activeModal} onClose={closeModal} className="lg">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('qr_edit')}</div>
          <div className="modal-sub font-mono">{marker?.marker_code || qrId}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <QrImagePreview
              markerId={qrId}
              markerCode={marker?.marker_code}
              qrImageUrl={marker?.qr_image_url}
              t={t}
              toast={toast}
              onRegenerated={(updated) => {
                setMarker(updated)
                refreshData()
              }}
            />
            <div className="form-row">
              <label className="form-label">{t('qr_project')}</label>
              <input className="form-input" value={marker?.project_name || ''} readOnly disabled />
            </div>
            <QrValidityFields
              validDays={validDays}
              setValidDays={setValidDays}
              expiresAt={marker?.expires_at}
              t={t}
            />
            <QrMarkerConfigFields t={t} form={form} set={set} />
          </>
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || loading} onClick={handleSave}>
          {submitting ? '...' : t('save_changes')}
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
        <GpsPoiFormFields
          t={t}
          models={models}
          modelId={modelId}
          setModelId={setModelId}
          type={type}
          setType={setType}
          name={name}
          setName={setName}
          lat={lat}
          setLat={setLat}
          lng={lng}
          setLng={setLng}
          elevation={elevation}
          setElevation={setElevation}
        />
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

function GpsPoiFormFields({
  t, models, modelId, setModelId, type, setType, name, setName,
  lat, setLat, lng, setLng, elevation, setElevation,
  depth = '', setDepth = () => {}, showDepth = false,
}) {
  return (
    <>
      <div className="form-row-grid">
        <div>
          <label className="form-label">{t('ele_bim_model')}</label>
          <select className="form-select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">—</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.version}</option>
            ))}
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
      <div className={`grid gap-3.5 ${showDepth ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
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
        {showDepth && (
          <div>
            <label className="form-label">{t('gps_depth')}</label>
            <input className="form-input" type="number" step="0.1" value={depth} onChange={(e) => setDepth(e.target.value)} />
          </div>
        )}
      </div>
    </>
  )
}

function GpsEditModal({ activeModal, modalData, closeModal, toast, t, refreshData }) {
  const poiId = modalData?.id
  const [poi, setPoi] = useState(null)
  const [models, setModels] = useState([])
  const [modelId, setModelId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('manhole')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [elevation, setElevation] = useState('')
  const [depth, setDepth] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'gps-edit' || !poiId) return
    setLoading(true)
    Promise.all([
      fetchGpsPoi(poiId),
      fetchBimModels({ limit: 100 }).catch(() => ({ data: [] })),
    ])
      .then(([data, modelsRes]) => {
        setPoi(data)
        setModels(modelsRes.data || [])
        setModelId(data.model_id || '')
        setName(data.name || '')
        setType(data.type || 'manhole')
        setLat(data.lat_wgs84 != null ? String(data.lat_wgs84) : '')
        setLng(data.lng_wgs84 != null ? String(data.lng_wgs84) : '')
        setElevation(data.elevation != null && data.elevation !== '' ? String(data.elevation) : '')
        setDepth(data.depth != null && data.depth !== '' ? String(data.depth) : '')
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, poiId, toast])

  const handleSave = async () => {
    if (!poiId || !name.trim() || lat === '' || lng === '') return
    setSubmitting(true)
    try {
      const updated = await updateGpsPoi(poiId, {
        model_id: modelId || null,
        name: name.trim(),
        type,
        lat_wgs84: Number(lat),
        lng_wgs84: Number(lng),
        elevation: elevation === '' ? null : Number(elevation),
        depth: depth === '' ? null : Number(depth),
      })
      setPoi(updated)
      refreshData()
      toast('success', t('saved'))
      closeModal()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="gps-edit" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('gps_edit')}</div>
          <div className="modal-sub">
            {poi?.project_name ? `${poi.project_name} · ` : ''}{poi?.name || poiId}
          </div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <GpsPoiFormFields
            t={t}
            models={models}
            modelId={modelId}
            setModelId={setModelId}
            type={type}
            setType={setType}
            name={name}
            setName={setName}
            lat={lat}
            setLat={setLat}
            lng={lng}
            setLng={setLng}
            elevation={elevation}
            setElevation={setElevation}
            depth={depth}
            setDepth={setDepth}
            showDepth
          />
        )}
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || loading || !name.trim() || lat === '' || lng === ''} onClick={handleSave}>
          {submitting ? '...' : t('save_changes')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function UserNewModal({ activeModal, closeModal, toast, t, refreshData, openModal }) {
  const { isAdmin } = usePermissions()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('engineer')
  const [language, setLanguage] = useState('vi')
  const [companyGroupId, setCompanyGroupId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passwordPolicy, setPasswordPolicy] = useState(null)

  useEffect(() => {
    if (activeModal !== 'user-new') return
    fetchPasswordPolicy().then(setPasswordPolicy).catch(() => setPasswordPolicy(null))
  }, [activeModal])

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password) return
    if (!isPasswordStrong(password, passwordPolicy || undefined)) {
      const fail = getRuleChecks(password, passwordPolicy || undefined).find((r) => !r.ok)
      toast('err', fail ? formatRuleLabel(t, fail) : t('register_password_min'))
      return
    }
    setSubmitting(true)
    try {
      await createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        language,
        company_group_id: companyGroupId || undefined,
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
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          <PasswordRequirements password={password} />
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
        <CompanyGroupField
          value={companyGroupId}
          onChange={setCompanyGroupId}
          allowCreate={isAdmin}
          onCreateClick={() => openModal('group-new')}
          t={t}
        />
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !fullName.trim() || !email.trim() || !password || !isPasswordStrong(password, passwordPolicy || undefined)} onClick={handleCreate}>
          {submitting ? '...' : t('user_new')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function UserEditModal({ activeModal, modalData, closeModal, toast, t, refreshData, openModal, dataVersion }) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('engineer')
  const [language, setLanguage] = useState('vi')
  const [companyGroupId, setCompanyGroupId] = useState('')
  const [companyGroupName, setCompanyGroupName] = useState('')
  const [canAssignEng, setCanAssignEng] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { isAdmin } = usePermissions()
  const { user: currentUser } = useAuth()
  const userId = modalData?.id
  const canDelete = isAdmin && userId && userId !== currentUser?.id

  useEffect(() => {
    if (activeModal !== 'user-edit' || !userId) return
    setNewPassword('')
    setLoading(true)
    fetchUser(userId)
      .then((u) => {
        setFullName(u.full_name || '')
        setRole(u.role || 'engineer')
        setLanguage(u.language || 'vi')
        setCompanyGroupId(u.company_group_id || '')
        setCompanyGroupName(u.company_group_name || '')
        setCanAssignEng(!!u.can_assign_engineers)
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, userId, toast, dataVersion])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const updated = await updateUser(userId, {
        full_name: fullName.trim(),
        role,
        language,
        company_group_id: companyGroupId || null,
        can_assign_engineers: role === 'bql' ? canAssignEng : false,
      })
      setRole(updated.role || role)
      setCompanyGroupId(updated.company_group_id || '')
      setCompanyGroupName(updated.company_group_name || '')
      if (isAdmin && newPassword.trim()) {
        await setUserPassword(userId, newPassword.trim())
      }
      refreshData()
      closeModal()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!canDelete) return
    if (!window.confirm(t('user_delete_confirm'))) return
    setSubmitting(true)
    try {
      await deleteUser(userId)
      refreshData()
      closeModal()
      toast('success', t('deleted'))
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
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)} disabled={!isAdmin}>
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
            <CompanyGroupField
              value={companyGroupId}
              selectedName={companyGroupName}
              onChange={(id, name = '') => {
                setCompanyGroupId(id)
                setCompanyGroupName(name)
              }}
              allowCreate={isAdmin}
              onCreateClick={() => openModal('group-new')}
              t={t}
            />
            {role === 'bql' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                <input type="checkbox" checked={canAssignEng} onChange={(e) => setCanAssignEng(e.target.checked)} disabled={!isAdmin} />
                {t('user_can_assign_eng')}
              </label>
            )}
            {isAdmin && (
              <div className="form-row mt-2">
                <label className="form-label">{t('user_new_password')}</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('user_new_password_ph')}
                  autoComplete="new-password"
                />
              </div>
            )}
          </>
        )}
      </div>
      <div className="modal-ft">
        {canDelete ? (
          <button type="button" className="btn btn-d" disabled={submitting} onClick={handleDelete}>
            <Icon name="trash" size={14} /> {t('delete')}
          </button>
        ) : null}
        <div className="flex-1" />
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || loading || !isAdmin} onClick={handleSave}>
          {submitting ? '...' : t('save')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ElementDetailModal({ activeModal, modalData, closeModal, openModal, toast, t, refreshData }) {
  const [el, setEl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [colorHex, setColorHex] = useState('#3B82F6')
  const [opacityPct, setOpacityPct] = useState(100)
  const [savingStyle, setSavingStyle] = useState(false)
  const guid = modalData?.id

  useEffect(() => {
    if (activeModal !== 'element-detail' || !guid) return
    setLoading(true)
    fetchElement(guid, modalData?.model_id ? { model_id: modalData.model_id } : {})
      .then((data) => {
        setEl(data)
        setColorHex(data.color_hex || '#3B82F6')
        setOpacityPct(data.opacity_pct ?? 100)
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, guid, modalData?.model_id, toast])

  const handleSaveStyle = async () => {
    if (!el?.model_id) {
      toast('err', t('ele_bim_unlinked'))
      return
    }
    setSavingStyle(true)
    try {
      await updateElementStyle(guid, {
        model_id: el.model_id,
        color_hex: colorHex,
        opacity_pct: opacityPct,
      })
      refreshData?.()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSavingStyle(false)
    }
  }

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
                      className="text-primary-dark font-semibold cursor-pointer bg-transparent border-none p-0 hover:underline"
                      onClick={() => { closeModal(); openModal('bim-detail', { id: el.model_id }) }}
                    >
                      {elementBimLabel(el, t)}
                    </button>
                  ) : (
                    <span className="text-text-muted font-normal">{t('ele_bim_unlinked')}</span>
                  )}
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
            <div className="mt-4 p-3 border border-border rounded-lg bg-[#F9FAFB]">
              <div className="font-semibold text-sm mb-2">{t('ele_style_title')}</div>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="form-label">{t('ele_color')}</label>
                  <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="h-10 w-14" />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="form-label">{t('ele_opacity')} ({opacityPct}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacityPct}
                    onChange={(e) => setOpacityPct(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <span
                  className="w-12 h-12 rounded-lg border border-border shrink-0"
                  style={{ background: colorHex, opacity: opacityPct / 100 }}
                />
              </div>
              <button type="button" className="btn btn-p btn-sm mt-3" disabled={savingStyle || !el.model_id} onClick={handleSaveStyle}>
                {savingStyle ? '...' : t('save')}
              </button>
            </div>
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
        {el?.sample_feedback_id && (
          <button
            type="button"
            className="btn btn-p"
            onClick={() => {
              closeModal()
              openModal('feedback', { id: el.sample_feedback_id })
            }}
          >
            <Icon name="edit" size={14} /> {t('ele_edit')}
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            closeModal()
            openModal('feedback-new', {
              location_type: 'element',
              element_guid: el?.id || guid,
              models_id: el?.model_id || undefined,
              model_id: el?.model_id || undefined,
            })
          }}
        >
          <Icon name="plus" size={14} /> {t('ele_new')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function BimUploadModal({ activeModal, closeModal, toast, t, refreshData }) {
  const ifcInputRef = useRef(null)
  const previewInputRef = useRef(null)
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [discipline, setDiscipline] = useState('architecture')
  const [desc, setDesc] = useState('')
  const [ifcFile, setIfcFile] = useState(null)
  const [previewFiles, setPreviewFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  useEffect(() => {
    if (activeModal !== 'bim-upload') return
    setIfcFile(null)
    setPreviewFiles([])
    setUploadProgress(null)
    if (ifcInputRef.current) ifcInputRef.current.value = ''
    if (previewInputRef.current) previewInputRef.current.value = ''
    fetchProjects({ limit: 50 })
      .then((r) => {
        const list = r.data || []
        setProjects(list)
        setProjectId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev
          return list[0]?.id || ''
        })
      })
      .catch(() => {
        setProjects([])
        setProjectId('')
      })
  }, [activeModal])

  const missingSubmit = []
  if (!projectId) missingSubmit.push(t('bu_need_project'))
  if (!version.trim()) missingSubmit.push(t('bu_need_version'))
  if (!ifcFile) missingSubmit.push(t('bu_need_ifc'))
  const canSubmit = missingSubmit.length === 0

  const handleCreate = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setUploadProgress({ phase: 'upload', percent: 0, etaSeconds: null })
    try {
      await uploadIfcBimModel({
        project_id: projectId,
        name: name.trim() || undefined,
        version: version.trim(),
        discipline,
        description: desc.trim() || undefined,
        ifcFile,
        previewFiles,
        onProgress: setUploadProgress,
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
      setName('')
      setVersion('v1.0')
      setDesc('')
      setIfcFile(null)
      setPreviewFiles([])
      setUploadProgress(null)
      if (ifcInputRef.current) ifcInputRef.current.value = ''
      if (previewInputRef.current) previewInputRef.current.value = ''
    } catch (err) {
      toast('err', err.message)
      setUploadProgress(null)
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
        {submitting && uploadProgress && (
          <UploadDonut
            t={t}
            percent={uploadProgress.percent ?? 0}
            phase={uploadProgress.phase}
            etaSeconds={uploadProgress.etaSeconds}
            label={
              uploadProgress.phase === 'processing'
                ? t('bu_upload_phase_process')
                : t('bu_upload_phase_upload')
            }
            sublabel={
              ifcFile
                ? (() => {
                    const totalMb = (ifcFile.size / (1024 * 1024)).toFixed(1)
                    if (uploadProgress.phase === 'upload' && uploadProgress.loaded != null) {
                      const doneMb = (uploadProgress.loaded / (1024 * 1024)).toFixed(1)
                      return `${ifcFile.name} · ${doneMb} / ${totalMb} MB`
                    }
                    return `${ifcFile.name} · ${totalMb} MB`
                  })()
                : undefined
            }
          />
        )}
        <div className={submitting ? 'opacity-60 pointer-events-none select-none' : undefined}>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('bu_proj')} <span className="req">*</span></label>
            <select className="form-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!projects.length || submitting}>
              {!projects.length && <option value="">{t('empty_projects')}</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('bu_type')} <span className="req">*</span></label>
            <DisciplineSelect value={discipline} onChange={setDiscipline} required disabled={submitting} />
          </div>
        </div>
        <div className="form-row-grid">
          <div>
            <label className="form-label">{t('bu_name')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tòa A – F4" disabled={submitting} />
          </div>
          <div>
            <label className="form-label">{t('bu_ver')} <span className="req">*</span></label>
            <input className="form-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0" disabled={submitting} />
          </div>
        </div>
        <div className="form-row">
          <label className="form-label">{t('bu_desc')}</label>
          <textarea className="form-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('bu_desc_ph')} disabled={submitting} />
        </div>
        <div className="form-row">
          <label className="form-label">{t('bu_ifc')} <span className="req">*</span></label>
          <input
            ref={ifcInputRef}
            type="file"
            accept=".ifc,.IFC,application/octet-stream"
            className="form-input py-2 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary-dark"
            disabled={submitting}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setIfcFile(file)
            }}
          />
          {ifcFile && <div className="text-xs text-text-muted mt-1">{ifcFile.name}</div>}
          <div className="text-xs text-text-muted mt-1">{t('bu_ifc_hint')}</div>
        </div>
        <div className="form-row">
          <label className="form-label">{t('bu_prev')} {t('bu_prev_opt')}</label>
          <input
            ref={previewInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="form-input py-2"
            disabled={submitting}
            onChange={(e) => setPreviewFiles(Array.from(e.target.files || []).slice(0, 8))}
          />
          {previewFiles.length > 0 && (
            <div className="text-xs text-text-muted mt-1">{previewFiles.map((f) => f.name).join(', ')}</div>
          )}
          <div className="text-xs text-text-muted mt-1">{t('bu_prev_hint')}</div>
        </div>
        </div>
      </div>
      <div className="modal-ft flex-col items-stretch sm:flex-row sm:items-center gap-2">
        {!canSubmit && missingSubmit.length > 0 && (
          <p className="text-xs text-text-muted flex-1 order-first sm:order-none w-full sm:w-auto">
            {t('bu_submit_need')}: {missingSubmit.join(' · ')}
          </p>
        )}
        <div className="flex gap-2 justify-end flex-1">
          <button type="button" className="btn" onClick={closeModal} disabled={submitting}>{t('cancel')}</button>
          <button type="button" className="btn btn-p" disabled={submitting || !canSubmit} onClick={handleCreate}>
            <Icon name="upload" size={14} /> {submitting ? (uploadProgress?.phase === 'processing' ? t('bu_upload_phase_process') : t('bu_upload_phase_upload')) : 'Upload'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

function GroupNewModal({ activeModal, closeModal, toast, t, refreshData }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'group-new') setName('')
  }, [activeModal])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await createCompanyGroup(name.trim())
      refreshData()
      closeModal()
      toast('success', t('created'))
      setName('')
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="group-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('group_create_title')}</div>
          <div className="modal-sub">{t('group_create_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row">
          <label className="form-label">{t('group_name_label')} <span className="req">*</span></label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('group_name_ph')}
            autoFocus
          />
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !name.trim()} onClick={handleCreate}>
          {submitting ? '...' : t('group_create_btn')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function GroupEditModal({ activeModal, modalData, closeModal, toast, t, refreshData }) {
  const groupId = modalData?.id
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal === 'group-edit' && modalData?.name != null) {
      setName(modalData.name)
    } else if (activeModal !== 'group-edit') {
      setName('')
    }
  }, [activeModal, modalData?.id, modalData?.name])

  const handleSave = async () => {
    if (!groupId || !name.trim()) return
    setSubmitting(true)
    try {
      await updateCompanyGroup(groupId, { name: name.trim() })
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
    <ModalOverlay id="group-edit" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('group_edit_title')}</div>
          <div className="modal-sub">{t('group_edit_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row">
          <label className="form-label">{t('group_name_label')} <span className="req">*</span></label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('group_name_ph')}
            autoFocus
          />
        </div>
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !name.trim()} onClick={handleSave}>
          {submitting ? '...' : t('save_changes')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function GroupDetailModal({ activeModal, modalData, closeModal, toast, t, refreshData, refreshProjects, openModal }) {
  const groupId = modalData?.id
  const { canManageProjectTeam } = usePermissions()
  const [tab, setTab] = useState('members')
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [userPickId, setUserPickId] = useState('')
  const [userCandidates, setUserCandidates] = useState([])
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [projQuery, setProjQuery] = useState('')
  const [projPickId, setProjPickId] = useState('')
  const [projCandidates, setProjCandidates] = useState([])
  const [projPickerOpen, setProjPickerOpen] = useState(false)
  const [addingProj, setAddingProj] = useState(false)
  const userSearchTimer = useRef(null)

  const reload = useCallback(async () => {
    if (!groupId) return
    const data = await fetchCompanyGroup(groupId)
    setGroup(data)
  }, [groupId])

  useEffect(() => {
    if (activeModal !== 'group-detail' || !groupId) return
    setTab(modalData?.tab === 'projects' ? 'projects' : 'members')
    setUserQuery('')
    setUserPickId('')
    setProjQuery('')
    setProjPickId('')
    setLoading(true)
    reload()
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, groupId, modalData?.tab, reload, toast])

  useEffect(() => {
    if (activeModal !== 'group-detail' || tab !== 'members') return undefined
    clearTimeout(userSearchTimer.current)
    userSearchTimer.current = setTimeout(async () => {
      try {
        const q = userQuery.trim()
        const params = { limit: 25, role: 'engineer' }
        if (q) params.search = q
        const res = await fetchUsers(params)
        const inGroup = new Set((group?.users || []).map((u) => u.id))
        setUserCandidates((res.data || []).filter((u) => !inGroup.has(u.id) && u.role !== 'admin'))
      } catch {
        setUserCandidates([])
      }
    }, userQuery.trim().length >= 1 ? 280 : 0)

    return () => clearTimeout(userSearchTimer.current)
  }, [activeModal, tab, userQuery, group?.users])

  useEffect(() => {
    if (activeModal !== 'group-detail' || tab !== 'projects' || !canManageProjectTeam) return
    const q = projQuery.trim().toLowerCase()
    fetchProjects({ limit: 80 })
      .then((res) => {
        const assigned = new Set((group?.projects || []).map((p) => p.id))
        let list = (res.data || []).filter((p) => !assigned.has(p.id))
        if (q) list = list.filter((p) => p.name.toLowerCase().includes(q))
        setProjCandidates(list.slice(0, 30))
      })
      .catch(() => setProjCandidates([]))
  }, [activeModal, tab, projQuery, group?.projects, canManageProjectTeam])

  const handleAddUser = async () => {
    if (!userPickId || !groupId) return
    setAddingUser(true)
    try {
      await updateUser(userPickId, { company_group_id: groupId })
      await reload()
      refreshData()
      setUserPickId('')
      setUserQuery('')
      setUserPickerOpen(false)
      toast('success', t('cg_user_added'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setAddingUser(false)
    }
  }

  const handleRemoveUser = async (userId) => {
    if (!window.confirm(t('cg_user_remove_confirm'))) return
    try {
      await updateUser(userId, { company_group_id: null })
      await reload()
      refreshData()
      toast('success', t('cg_user_removed'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleAddProject = async () => {
    if (!projPickId || !groupId) return
    setAddingProj(true)
    try {
      await assignProjectGroup(projPickId, groupId)
      await reload()
      refreshData()
      refreshProjects?.()
      setProjPickId('')
      setProjQuery('')
      setProjPickerOpen(false)
      toast('success', t('prj_group_added'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setAddingProj(false)
    }
  }

  const handleRemoveProject = async (projectId) => {
    if (!groupId || !window.confirm(t('cg_project_remove_confirm'))) return
    try {
      await removeProjectGroup(projectId, groupId)
      await reload()
      refreshData()
      refreshProjects?.()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  const pickedUser = userCandidates.find((u) => u.id === userPickId)
  const pickedProj = projCandidates.find((p) => p.id === projPickId)

  return (
    <ModalOverlay id="group-detail" activeModal={activeModal} onClose={closeModal} className="xl">
      <div className="modal-hd">
        <div>
          <div className="modal-title">{group?.name || t('cg_detail_title')}</div>
          <div className="modal-sub">{t('cg_detail_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading && !group ? (
          <div className="text-center py-10 text-text-muted">{t('loading')}</div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 border-b border-border">
              {[
                { id: 'members', label: t('cg_tab_members'), count: group?.users?.length ?? 0 },
                { id: 'projects', label: t('cg_tab_projects'), count: group?.projects?.length ?? 0 },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  className={`tab ${tab === id ? 'on' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {label} ({count})
                </button>
              ))}
              <button type="button" className="btn btn-sm ml-auto mb-1" onClick={() => openModal('group-edit', { id: groupId, name: group?.name })}>
                <Icon name="edit" size={14} /> {t('edit')}
              </button>
            </div>

            {tab === 'members' && (
              <>
                <p className="text-xs text-text-muted mb-3">{t('cg_members_hint')}</p>
                <div className="card p-3 mb-4 bg-[#F9FAFB] border border-border">
                  <label className="form-label">{t('cg_add_member')}</label>
                  <div className="relative">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                    <input
                      className="form-input w-full pl-[38px]"
                      value={userQuery}
                      onChange={(e) => { setUserQuery(e.target.value); setUserPickId(''); setUserPickerOpen(true) }}
                      onFocus={() => setUserPickerOpen(true)}
                      placeholder={t('user_search')}
                      disabled={addingUser}
                    />
                  </div>
                  {pickedUser && (
                    <div className="text-xs mt-1.5">{t('add')}: <b>{pickedUser.full_name}</b> · {pickedUser.email}</div>
                  )}
                  {userPickerOpen && userCandidates.length > 0 && (
                    <div className="border border-border rounded-lg mt-2 max-h-[180px] overflow-auto bg-white shadow-sm">
                      {userCandidates.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 border-none bg-transparent hover:bg-primary-light cursor-pointer text-[13px]"
                          onClick={() => { setUserPickId(u.id); setUserQuery(u.full_name); setUserPickerOpen(false) }}
                        >
                          {u.full_name} <span className="text-text-muted">· {u.email}</span>
                          {u.company_group_name && <span className="text-xs text-orange-600"> ({u.company_group_name})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" className="btn btn-p btn-sm mt-3" disabled={addingUser || !userPickId} onClick={handleAddUser}>
                    {addingUser ? '...' : t('cg_add_member_btn')}
                  </button>
                </div>
                {(group?.users || []).length === 0 ? (
                  <div className="text-sm text-text-muted py-4">{t('cg_no_members')}</div>
                ) : (
                  <ul className="list-none p-0 m-0 space-y-2">
                    {(group?.users || []).map((u) => (
                      <li key={u.id} className="flex items-center gap-3 p-2.5 border border-border rounded-lg">
                        <div className="avatar">{initials(u.full_name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] truncate">{u.full_name}</div>
                          <div className="text-xs text-text-muted truncate">{u.email} · {u.role}</div>
                        </div>
                        <button type="button" className="btn-icon text-danger" onClick={() => handleRemoveUser(u.id)} title={t('remove')}>
                          <Icon name="x" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'projects' && (
              <>
                <p className="text-xs text-text-muted mb-3">{t('cg_projects_hint')}</p>
                {!canManageProjectTeam ? (
                  <div className="text-sm text-text-muted py-4">{t('cg_projects_readonly')}</div>
                ) : (
                  <div className="card p-3 mb-4 bg-[#F9FAFB] border border-border">
                    <label className="form-label">{t('cg_add_project')}</label>
                    <div className="relative">
                      <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                      <input
                        className="form-input w-full pl-[38px]"
                        value={projQuery}
                        onChange={(e) => { setProjQuery(e.target.value); setProjPickId(''); setProjPickerOpen(true) }}
                        onFocus={() => setProjPickerOpen(true)}
                        placeholder={t('prj_search')}
                        disabled={addingProj}
                      />
                    </div>
                    {pickedProj && <div className="text-xs mt-1.5">{t('add')}: <b>{pickedProj.name}</b></div>}
                    {projPickerOpen && projCandidates.length > 0 && (
                      <div className="border border-border rounded-lg mt-2 max-h-[180px] overflow-auto bg-white shadow-sm">
                        {projCandidates.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 border-none bg-transparent hover:bg-primary-light cursor-pointer text-[13px]"
                            onClick={() => { setProjPickId(p.id); setProjQuery(p.name); setProjPickerOpen(false) }}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" className="btn btn-p btn-sm mt-3" disabled={addingProj || !projPickId} onClick={handleAddProject}>
                      {addingProj ? '...' : t('cg_add_project_btn')}
                    </button>
                  </div>
                )}
                {(group?.projects || []).length === 0 ? (
                  <div className="text-sm text-text-muted py-4">{t('cg_no_projects')}</div>
                ) : (
                  <ul className="list-none p-0 m-0 space-y-2">
                    {(group?.projects || []).map((p) => (
                      <li key={p.id} className="flex items-center gap-3 p-2.5 border border-border rounded-lg">
                        <Icon name="building" size={20} className="text-primary-dark shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] truncate">{p.name}</div>
                          <div className="text-xs text-text-muted truncate">{p.address || '—'} · {p.status}</div>
                        </div>
                        <button type="button" className="btn btn-sm" onClick={() => { closeModal(); openModal('project', { id: p.id, tab: 'team' }) }}>
                          {t('cg_open_project')}
                        </button>
                        {canManageProjectTeam && (
                          <button type="button" className="btn-icon text-danger" onClick={() => handleRemoveProject(p.id)}>
                            <Icon name="x" size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
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

function parseFeedbackImages(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean)
  const parsed = parseJson(raw, [])
  return Array.isArray(parsed) ? parsed.filter(Boolean) : []
}

function FeedbackNewModal({ activeModal, closeModal, toast, t, refreshData, modalData }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState('normal')
  const [locationType, setLocationType] = useState('gps')
  const [projectId, setProjectId] = useState('')
  const [projectLabel, setProjectLabel] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelLabel, setModelLabel] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [elementGuid, setElementGuid] = useState('')
  const [markerId, setMarkerId] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (activeModal !== 'feedback-new') return
    setTitle('')
    setContent('')
    setPriority('normal')
    const presetLoc = modalData?.location_type === 'element' ? 'element' : 'gps'
    setLocationType(presetLoc)
    setLat('')
    setLng('')
    setElementGuid(modalData?.element_guid || '')
    setMarkerId('')
    setImageUrls([])
    setProjectId(modalData?.project_id || '')
    setProjectLabel(modalData?.project_name || '')
    setModelId(modalData?.models_id || modalData?.model_id || '')
    setModelLabel(modalData?.model_name || '')
    if (modalData?.project_id && !modalData?.project_name) {
      fetchProjects({ limit: 50 })
        .then((r) => {
          const p = (r.data || []).find((x) => x.id === modalData.project_id)
          if (p) setProjectLabel(p.name)
        })
        .catch(() => {})
    }
    if (modalData?.models_id && !modalData?.model_name && modalData?.project_id) {
      fetchBimModels({ project_id: modalData.project_id, limit: 50 })
        .then((r) => {
          const m = (r.data || []).find((x) => x.id === modalData.models_id)
          if (m) setModelLabel(`${m.name} (v${m.version})`)
        })
        .catch(() => {})
    }
  }, [activeModal, modalData?.project_id, modalData?.models_id, modalData?.model_id, modalData?.project_name, modalData?.model_name, modalData?.location_type, modalData?.element_guid])

  const handleCreate = async () => {
    if (!content.trim()) return
    if (locationType === 'element' && !elementGuid.trim()) {
      toast('err', t('ele_guid_required'))
      return
    }
    setSubmitting(true)
    try {
      await createFeedback({
        title: title.trim() || null,
        content: content.trim(),
        priority,
        location_type: locationType === 'element' ? 'gps' : locationType,
        models_id: modelId || null,
        lat: lat === '' ? null : Number(lat),
        lng: lng === '' ? null : Number(lng),
        element_guid: elementGuid.trim() || null,
        marker_id: markerId.trim() || null,
        images: imageUrls.length ? imageUrls : null,
      })
      refreshData()
      closeModal()
      toast('success', t('created'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalOverlay id="feedback-new" activeModal={activeModal} onClose={closeModal}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">{t('fb_new_title')}</div>
          <div className="modal-sub">{t('fb_new_sub')}</div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        <div className="form-row">
          <label className="form-label">{t('fb_field_title')}</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('fb_field_title_ph')}
            autoFocus
          />
        </div>
        <div className="form-row">
          <label className="form-label">{t('fb_field_content')} <span className="req">*</span></label>
          <textarea
            className="form-input min-h-[120px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('fb_field_content_ph')}
          />
        </div>
        <FeedbackProjectModelFields
          t={t}
          projectId={projectId}
          projectLabel={projectLabel}
          modelId={modelId}
          modelLabel={modelLabel}
          onProjectChange={(id, name) => {
            setProjectId(id)
            setProjectLabel(name)
            setModelId('')
            setModelLabel('')
          }}
          onModelChange={(id, name) => {
            setModelId(id)
            setModelLabel(name)
          }}
        />
        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
          <div className="form-row mb-0">
            <label className="form-label">{t('fb_field_priority')}</label>
            <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">{t('prio_high')}</option>
              <option value="normal">{t('prio_medium')}</option>
              <option value="low">{t('prio_low')}</option>
            </select>
          </div>
          <div className="form-row mb-0">
            <label className="form-label">{t('fb_field_location')}</label>
            <select className="form-select" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
              <option value="gps">{t('fb_loc_gps')}</option>
              <option value="qr">{t('fb_loc_qr')}</option>
              <option value="element">{t('fb_loc_element')}</option>
            </select>
          </div>
        </div>
        <div className="form-row mb-0">
          <label className="form-label">{t('fb_field_status')}</label>
          <input className="form-input" value={t('fb_open')} readOnly disabled />
        </div>
        {(locationType === 'gps' || locationType === 'qr') && (
          <div className="form-row-grid">
            <div>
              <label className="form-label">{t('fb_lat')}</label>
              <input className="form-input font-mono" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <label className="form-label">{t('fb_lng')}</label>
              <input className="form-input font-mono" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
        )}
        {locationType === 'qr' && (
          <div className="form-row">
            <label className="form-label">{t('fb_marker_id')}</label>
            <input className="form-input font-mono text-sm" value={markerId} onChange={(e) => setMarkerId(e.target.value)} placeholder="UUID marker hoặc mã QR" />
          </div>
        )}
        {locationType === 'element' && (
          <div className="form-row">
            <label className="form-label">{t('ele_code')}</label>
            <input className="form-input font-mono text-sm" value={elementGuid} onChange={(e) => setElementGuid(e.target.value)} />
          </div>
        )}
        <FeedbackImagesField images={imageUrls} onChange={setImageUrls} t={t} toast={toast} />
      </div>
      <div className="modal-ft">
        <button type="button" className="btn" onClick={closeModal}>{t('cancel')}</button>
        <button type="button" className="btn btn-p" disabled={submitting || !content.trim()} onClick={handleCreate}>
          {submitting ? '...' : t('fb_new_btn')}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ProjectModal({ activeModal, modalData, closeModal, toast, t, refreshProjects, openModal, dataVersion }) {
  const { canManageProjects, canManageProjectTeam, isAdmin } = usePermissions()
  const [tab, setTab] = useState('info')
  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [team, setTeam] = useState([])
  const [projectGroups, setProjectGroups] = useState([])
  const [projectAttributeGroups, setProjectAttributeGroups] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [allAttributeGroups, setAllAttributeGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [memberQuery, setMemberQuery] = useState('')
  const [pickUserId, setPickUserId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [assetLoading, setAssetLoading] = useState(false)
  const [projectQr, setProjectQr] = useState([])
  const [projectBim, setProjectBim] = useState([])
  const [projectFb, setProjectFb] = useState([])
  const [projectGps, setProjectGps] = useState([])
  const memberBoxRef = useRef(null)
  const memberSearchTimer = useRef(null)
  const projectId = modalData?.id
  const projectTabs = ['info', 'team', 'qr', 'bim', 'feedback', 'gps']

  const pickedUser = useMemo(
    () => candidates.find((u) => u.id === pickUserId) || team.find((u) => u.id === pickUserId),
    [candidates, pickUserId, team],
  )

  const reloadTeam = async () => {
    if (!projectId) return
    const teamRes = await fetchProjectTeam(projectId)
    setTeam(teamRes.data || [])
    setProjectGroups(teamRes.groups || [])
    setProjectAttributeGroups(teamRes.attribute_groups || [])
  }

  useEffect(() => {
    if (activeModal !== 'project' || !projectId) return
    setLoading(true)
    setTab(projectTabs.includes(modalData?.tab) ? modalData.tab : 'info')
    setAddOpen(false)
    setPickUserId('')
    setMemberQuery('')
    setPickerOpen(false)
    Promise.all([
      fetchProject(projectId),
      fetchProjectStats(projectId),
      fetchProjectTeam(projectId),
    ])
      .then(([p, s, teamRes]) => {
        setProject(p)
        setStats(s)
        setTeam(teamRes.data || [])
        setProjectGroups(teamRes.groups || [])
        setProjectAttributeGroups(teamRes.attribute_groups || [])
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, projectId, modalData?.tab, toast])

  useEffect(() => {
    if (activeModal !== 'project' || tab !== 'team') return
    fetchCompanyGroups()
      .then((r) => setAllGroups(r.data || []))
      .catch(() => setAllGroups([]))
    fetchProjectAttributeGroups()
      .then((r) => setAllAttributeGroups(r.data || []))
      .catch(() => setAllAttributeGroups([]))
  }, [activeModal, tab, dataVersion])

  useEffect(() => {
    if (activeModal !== 'project' || !projectId) return undefined
    if (!['qr', 'bim', 'feedback', 'gps'].includes(tab)) return undefined
    let cancelled = false
    setAssetLoading(true)
    const load = async () => {
      try {
        if (tab === 'qr') {
          const r = await fetchQrMarkers({ project_id: projectId, limit: 50 })
          if (!cancelled) setProjectQr(r.data || [])
        } else if (tab === 'bim') {
          const r = await fetchBimModels({ project_id: projectId, limit: 50 })
          if (!cancelled) setProjectBim(r.data || [])
        } else if (tab === 'feedback') {
          const r = await fetchFeedbacks({ project_id: projectId, limit: 50 })
          if (!cancelled) setProjectFb(r.data || [])
        } else if (tab === 'gps') {
          const r = await fetchGpsPois({ project_id: projectId, limit: 50 })
          if (!cancelled) setProjectGps(r.data || [])
        }
      } catch (err) {
        if (!cancelled) toast('err', err.message)
      } finally {
        if (!cancelled) setAssetLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeModal, projectId, tab, toast, dataVersion])

  useEffect(() => {
    if (!addOpen) return
    const onDoc = (e) => {
      if (memberBoxRef.current && !memberBoxRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [addOpen])

  useEffect(() => {
    if (!addOpen || !projectId) {
      setCandidates([])
      return undefined
    }
    clearTimeout(memberSearchTimer.current)
    memberSearchTimer.current = setTimeout(async () => {
      setSearchingMembers(true)
      try {
        const q = memberQuery.trim()
        const res = await fetchUsers({ limit: 30, search: q || undefined })
        const teamIds = new Set(team.map((u) => u.id))
        const list = (res.data || []).filter(
          (u) => !teamIds.has(u.id) && u.role !== 'admin',
        )
        setCandidates(list)
        if (q) setPickerOpen(true)
      } catch {
        setCandidates([])
      } finally {
        setSearchingMembers(false)
      }
    }, memberQuery.trim().length >= 1 ? 280 : 0)

    return () => clearTimeout(memberSearchTimer.current)
  }, [addOpen, projectId, team, memberQuery])

  const handleAddMember = async () => {
    if (!projectId || !pickUserId) return
    setAddingMember(true)
    try {
      await assignEngineer(projectId, pickUserId)
      await reloadTeam()
      setAddOpen(false)
      setPickUserId('')
      setMemberQuery('')
      setPickerOpen(false)
      toast('success', t('prj_member_added'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!projectId || !window.confirm(t('prj_remove_member') + '?')) return
    try {
      await removeTeamMember(projectId, userId)
      await reloadTeam()
      toast('success', t('prj_member_removed'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleAddGroup = async (groupId) => {
    if (!projectId || !groupId) return
    try {
      await assignProjectGroup(projectId, groupId)
      await reloadTeam()
      refreshProjects()
      toast('success', t('prj_group_added'))
    } catch (err) {
      toast('err', err.message)
      throw err
    }
  }

  const handleAddAttributeGroup = async (groupId) => {
    if (!projectId || !groupId) return
    try {
      await assignProjectAttributeGroup(projectId, groupId)
      await reloadTeam()
      refreshProjects()
      toast('success', t('pag_assigned'))
    } catch (err) {
      toast('err', err.message)
      throw err
    }
  }

  const handleRemoveAttributeGroup = async (groupId) => {
    if (!projectId) return
    try {
      await removeProjectAttributeGroup(projectId, groupId)
      await reloadTeam()
      refreshProjects()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleRemoveGroup = async (groupId) => {
    if (!projectId) return
    try {
      await removeProjectGroup(projectId, groupId)
      await reloadTeam()
      refreshProjects()
      toast('success', t('deleted'))
    } catch (err) {
      toast('err', err.message)
    }
  }

  const handleDelete = async () => {
    if (!projectId || !window.confirm(t('prj_confirm_delete'))) return
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
                { id: 'bim', lbl: t('nav_bim'), val: stats?.bim_models ?? 0, icon: 'cube', cls: 'purple' },
                { id: 'qr', lbl: t('nav_qr'), val: stats?.qr_markers ?? 0, icon: 'qr', cls: 'green' },
                { id: 'gps', lbl: t('nav_gps'), val: stats?.gps_pois ?? 0, icon: 'map-pin', cls: 'orange' },
                { id: 'feedback', lbl: t('nav_feedback'), val: stats?.open_feedbacks ?? 0, icon: 'chat', cls: 'red', color: 'text-danger' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="stat text-left cursor-pointer hover:ring-2 hover:ring-primary/30 transition-shadow"
                  onClick={() => setTab(s.id)}
                >
                  <div className="stat-info"><div className="lbl">{s.lbl}</div><div className={`val ${s.color || ''}`}>{s.val}</div></div>
                  <div className={`stat-icon ${s.cls}`}><Icon name={s.icon} size={22} /></div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 border-b border-border mb-4">
              <div className="flex flex-1 gap-0.5 min-w-0 overflow-x-auto">
                {[
                  { id: 'info', label: t('prj_tab_info') },
                  { id: 'team', label: t('prj_tab_team') },
                  { id: 'qr', label: t('prj_tab_qr') },
                  { id: 'bim', label: t('prj_tab_bim') },
                  { id: 'feedback', label: t('prj_tab_fb') },
                  { id: 'gps', label: t('prj_tab_gps') },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`tab ${tab === id ? 'on' : ''}`}
                    onClick={() => {
                      setTab(id)
                      setAddOpen(false)
                      setMemberQuery('')
                      setPickUserId('')
                      setPickerOpen(false)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {canManageProjectTeam && tab === 'team' && (
                <button
                  type="button"
                  className="btn-icon shrink-0 mb-1 text-primary-dark hover:bg-primary-light"
                  onClick={() => {
                    setAddOpen((v) => {
                      const next = !v
                      if (next) {
                        setMemberQuery('')
                        setPickUserId('')
                        setPickerOpen(true)
                      }
                      return next
                    })
                  }}
                  aria-label={t('prj_add_member')}
                  title={t('prj_add_member')}
                >
                  <Icon name="plus" size={18} />
                </button>
              )}
            </div>
            {tab === 'info' && project && (
              <>
                <ul className="info-list">
                  <li><span>{t('pn_name')}</span><b>{project.name}</b></li>
                  <li><span>{t('pn_addr')}</span><b>{project.address || '—'}</b></li>
                  <li><span>{t('status')}</span><b>{project.status}</b></li>
                  <li><span>{t('pn_start')}</span><b>{formatDate(project.created_at)}</b></li>
                  <li>
                    <span>{t('prj_groups_title')}</span>
                    <b>
                      {projectGroups.length
                        ? projectGroups.map((g) => g.name).join(', ')
                        : t('group_none_assigned')}
                    </b>
                  </li>
                </ul>
                {projectGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {projectGroups.map((g) => (
                      <span key={g.company_group_id ?? g.id} className="chip chip-blue">{g.name}</span>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === 'qr' && (
              <>
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-p"
                    onClick={() => openModal('qr-new', { project_id: projectId, project_name: project?.name })}
                  >
                    <Icon name="plus" size={14} /> {t('qr_new')}
                  </button>
                </div>
                {assetLoading ? (
                <div className="text-center py-6 text-text-muted">{t('loading')}</div>
              ) : projectQr.length === 0 ? (
                <div className="text-sm text-text-muted py-4">{t('empty_qr')}</div>
              ) : (
                <ul className="list-none p-0 m-0 space-y-2">
                  {projectQr.map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        className="w-full text-left flex items-center gap-3 p-2.5 border border-border rounded-lg hover:bg-primary-light"
                        onClick={() => openModal('qr-view', { id: q.id, marker_code: q.marker_code })}
                      >
                        <Icon name="qr" size={18} className="text-primary-dark shrink-0" />
                        <span className="font-mono text-sm flex-1 truncate">{q.marker_code}</span>
                        <span className="text-xs text-text-muted">{q.floor_level || '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </>
            )}
            {tab === 'bim' && (
              assetLoading ? (
                <div className="text-center py-6 text-text-muted">{t('loading')}</div>
              ) : projectBim.length === 0 ? (
                <div className="text-sm text-text-muted py-4">{t('empty_bim')}</div>
              ) : (
                <ul className="list-none p-0 m-0 space-y-2">
                  {projectBim.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="w-full text-left flex items-center gap-3 p-2.5 border border-border rounded-lg hover:bg-primary-light"
                        onClick={() => openModal('bim-detail', { id: m.id })}
                      >
                        <Icon name="cube" size={18} className="text-primary-dark shrink-0" />
                        <span className="font-semibold text-sm flex-1 truncate">{m.name}</span>
                        <span className="text-xs text-text-muted">v{m.version}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
            {tab === 'feedback' && (
              <>
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-p"
                    onClick={() => openModal('feedback-new', { project_id: projectId, project_name: project?.name })}
                  >
                    <Icon name="plus" size={14} /> {t('fb_new')}
                  </button>
                </div>
                {assetLoading ? (
                  <div className="text-center py-6 text-text-muted">{t('loading')}</div>
                ) : projectFb.length === 0 ? (
                  <div className="text-sm text-text-muted py-4">{t('empty_feedback')}</div>
                ) : (
                <ul className="list-none p-0 m-0 space-y-2">
                  {projectFb.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="w-full text-left p-2.5 border border-border rounded-lg hover:bg-primary-light"
                        onClick={() => openModal('feedback', { id: f.id })}
                      >
                        <div className="flex justify-between gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">{f.title || t('fb_no_title')}</span>
                          <span className="text-xs text-text-muted shrink-0">{f.status}</span>
                        </div>
                        <div className="text-xs text-text-muted line-clamp-2">{f.content}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </>
            )}
            {tab === 'gps' && (
              assetLoading ? (
                <div className="text-center py-6 text-text-muted">{t('loading')}</div>
              ) : projectGps.length === 0 ? (
                <div className="text-sm text-text-muted py-4">{t('empty_poi')}</div>
              ) : (
                <ul className="list-none p-0 m-0 space-y-2">
                  {projectGps.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 p-2.5 border border-border rounded-lg">
                      <Icon name="map-pin" size={18} className="text-orange-600 shrink-0" />
                      <span className="font-semibold text-sm flex-1 truncate">{g.name || g.id}</span>
                      <span className="text-xs text-text-muted font-mono">
                        {g.lat_wgs84 != null ? `${g.lat_wgs84}, ${g.lng_wgs84}` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
            {tab === 'team' && (
              <>
                <div className="text-xs font-bold text-text-muted uppercase mb-2">{t('pag_title')}</div>
                <CompanyGroupAssign
                  assigned={projectAttributeGroups}
                  allGroups={allAttributeGroups}
                  onAssign={handleAddAttributeGroup}
                  onRemove={handleRemoveAttributeGroup}
                  canEdit={canManageProjectTeam}
                  canCreate={isAdmin}
                  onCreateClick={() => { closeModal(); window.location.assign(withBase('attribute-groups')) }}
                  t={t}
                />
                <div className="text-xs font-bold text-text-muted uppercase mb-2 mt-4">{t('prj_groups_title')}</div>
                <CompanyGroupAssign
                  assigned={projectGroups}
                  allGroups={allGroups}
                  onAssign={handleAddGroup}
                  onRemove={handleRemoveGroup}
                  canEdit={canManageProjectTeam}
                  canCreate={isAdmin}
                  onCreateClick={() => openModal('group-new')}
                  t={t}
                />
              </>
            )}
            {tab === 'team' && (
              <div className="text-xs font-bold text-text-muted uppercase mb-2 mt-4">{t('prj_members_title')}</div>
            )}
            {tab === 'team' && addOpen && canManageProjectTeam && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-4 p-3 bg-[#F9FAFB] rounded-lg border border-border-light">
                <div className="flex-1 min-w-0 relative" ref={memberBoxRef}>
                  <label className="form-label">{t('prj_pick_member')}</label>
                  <div className="relative">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10" />
                    <input
                      type="text"
                      className="form-input w-full pl-[38px]"
                      value={memberQuery}
                      onChange={(e) => {
                        setMemberQuery(e.target.value)
                        setPickUserId('')
                        setPickerOpen(true)
                      }}
                      onFocus={() => setPickerOpen(true)}
                      placeholder={t('prj_search_member')}
                      disabled={addingMember}
                      autoComplete="off"
                    />
                  </div>
                  {pickedUser && (
                    <div className="text-xs text-text-muted mt-1.5 truncate">
                      {t('add')}: <span className="font-semibold text-text">{pickedUser.full_name}</span>
                      {' · '}{pickedUser.email}
                    </div>
                  )}
                  {pickerOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-border rounded-lg shadow-lg max-h-[220px] overflow-auto z-[300]">
                      {searchingMembers && (
                        <div className="px-3 py-2 text-xs text-text-muted">{t('search_loading')}</div>
                      )}
                      {!searchingMembers && candidates.length === 0 && (
                        <div className="px-3 py-2 text-xs text-text-muted">
                          {memberQuery.trim() ? t('search_no_results') : t('prj_no_users_to_add')}
                        </div>
                      )}
                      {!searchingMembers && candidates.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`w-full text-left px-3 py-2.5 border-none bg-transparent cursor-pointer hover:bg-primary-light flex items-center gap-2.5 ${
                            pickUserId === u.id ? 'bg-primary-light' : ''
                          }`}
                          onClick={() => {
                            setPickUserId(u.id)
                            setMemberQuery(u.full_name)
                            setPickerOpen(false)
                          }}
                        >
                          <div className="avatar w-8 h-8 text-[11px] shrink-0">{initials(u.full_name)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold truncate">{u.full_name}</div>
                            <div className="text-[11px] text-text-muted truncate">{u.email} · {u.role}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setAddOpen(false)
                      setMemberQuery('')
                      setPickUserId('')
                      setPickerOpen(false)
                    }}
                    disabled={addingMember}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={handleAddMember}
                    disabled={addingMember || !pickUserId}
                  >
                    {addingMember ? '...' : t('add')}
                  </button>
                </div>
              </div>
            )}
            {tab === 'team' && team.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5 border-b border-dashed border-border">
                <div className="avatar">{initials(u.full_name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{u.full_name}</div>
                  <div className="text-xs text-text-muted truncate">
                    {u.email} · {u.role}{u.company_group_name ? ` · ${u.company_group_name}` : ''}
                  </div>
                </div>
                {canManageProjectTeam && (
                  <button
                    type="button"
                    className="btn-icon text-danger shrink-0"
                    onClick={() => handleRemoveMember(u.id)}
                    aria-label={t('prj_remove_member')}
                    title={t('prj_remove_member')}
                  >
                    <Icon name="x" size={16} />
                  </button>
                )}
              </div>
            ))}
            {tab === 'team' && team.length === 0 && !addOpen && (
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
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState('normal')
  const [status, setStatus] = useState('open')
  const [locationType, setLocationType] = useState('gps')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [elementGuid, setElementGuid] = useState('')
  const [markerId, setMarkerId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projectLabel, setProjectLabel] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelLabel, setModelLabel] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const fbId = modalData?.id

  const loadForm = (data) => {
    setFb(data)
    setTitle(data.title || '')
    setContent(data.content || '')
    setPriority(data.priority || 'normal')
    setStatus(data.status || 'open')
    setLocationType(data.location_type || 'gps')
    setLat(data.lat != null ? String(data.lat) : '')
    setLng(data.lng != null ? String(data.lng) : '')
    setElementGuid(data.element_guid || '')
    setMarkerId(data.marker_id || '')
    setProjectId(data.project_id || '')
    setProjectLabel(data.project_name || '')
    setModelId(data.models_id || '')
    setModelLabel(data.model_name ? `${data.model_name}` : '')
    setImageUrls(parseFeedbackImages(data.images))
    setPhotoIdx(0)
  }

  const loadComments = useCallback(() => {
    if (!fbId) return
    fetchFeedbackComments(fbId)
      .then((r) => setComments(r.data || []))
      .catch(() => setComments([]))
  }, [fbId])

  useEffect(() => {
    if (activeModal !== 'feedback' || !fbId) return
    setLoading(true)
    setCommentText('')
    fetchFeedback(fbId)
      .then(loadForm)
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
    loadComments()
  }, [activeModal, fbId, toast, loadComments])

  const handleSendComment = async () => {
    const body = commentText.trim()
    if (!body || !fbId) return
    setCommentSending(true)
    try {
      const row = await postFeedbackComment(fbId, body)
      setComments((prev) => [...prev, row])
      setCommentText('')
      toast('success', t('fb_comment_sent'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setCommentSending(false)
    }
  }

  const buildPayload = (overrides = {}) => ({
    title: title.trim() || null,
    content: content.trim(),
    priority,
    status,
    location_type: locationType,
    models_id: modelId || null,
    lat: lat === '' ? null : Number(lat),
    lng: lng === '' ? null : Number(lng),
    element_guid: elementGuid.trim() || null,
    marker_id: markerId.trim() || null,
    images: imageUrls,
    ...overrides,
  })

  const handleSave = async () => {
    if (!content.trim()) {
      toast('err', t('fb_content_required'))
      return
    }
    setSaving(true)
    try {
      const updated = await updateFeedback(fbId, buildPayload())
      loadForm(updated)
      refreshData()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async () => {
    setSaving(true)
    try {
      await updateFeedback(fbId, buildPayload({ status: 'resolved' }))
      refreshData()
      toast('success', t('saved'))
      closeModal()
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('fb_delete_confirm'))) return
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
          <div className="modal-title">{t('fb_edit_title')}</div>
          <div className="modal-sub">
            {fb?.user_name} · {formatDateTime(fb?.created_at)}
            {fb?.project_name ? ` · ${fb.project_name}` : ''}
          </div>
        </div>
        <ModalClose onClose={closeModal} />
      </div>
      <div className="modal-body">
        {loading || !fb ? (
          <div className="text-center py-8 text-text-muted">{t('loading')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
            <div>
              <div className="card-sub mb-2 font-semibold">{t('fb_photos')}</div>
              <div className="aspect-[4/3] bg-border-light rounded-[10px] overflow-hidden mb-2 border border-border">
                {imageUrls.length > 0 ? (
                  <S3Image src={imageUrls[photoIdx]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-text-muted">{t('fb_no_photos')}</div>
                )}
              </div>
              {imageUrls.length > 1 && (
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {imageUrls.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      className={`aspect-square rounded-md overflow-hidden border-2 p-0 ${photoIdx === i ? 'border-primary' : 'border-transparent'}`}
                      onClick={() => setPhotoIdx(i)}
                    >
                      <S3Image src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <FeedbackImagesField images={imageUrls} onChange={(urls) => { setImageUrls(urls); setPhotoIdx(0) }} t={t} toast={toast} />
              <div className="card mt-4 p-3.5 mb-0 bg-[#F9FAFB]">
                <ul className="info-list">
                  <li><span>{t('fb_field_reporter')}</span><b>{fb.user_name}{fb.user_email ? ` (${fb.user_email})` : ''}</b></li>
                  <li><span>{t('fb_field_project')}</span><b>{fb.project_name || '—'}</b></li>
                  <li><span>{t('created')}</span><b>{formatDateTime(fb.created_at)}</b></li>
                </ul>
              </div>
            </div>
            <div>
              <div className="form-row">
                <label className="form-label">{t('fb_field_title')}</label>
                <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t('fb_field_content')} <span className="req">*</span></label>
                <textarea
                  className="form-input min-h-[100px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <FeedbackProjectModelFields
                t={t}
                projectId={projectId}
                projectLabel={projectLabel}
                modelId={modelId}
                modelLabel={modelLabel}
                onProjectChange={(id, name) => {
                  setProjectId(id)
                  setProjectLabel(name)
                  setModelId('')
                  setModelLabel('')
                }}
                onModelChange={(id, name) => {
                  setModelId(id)
                  setModelLabel(name)
                }}
              />
              <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1 mb-4">
                <div className="form-row mb-0">
                  <label className="form-label">{t('fb_field_priority')}</label>
                  <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="high">{t('prio_high')}</option>
                    <option value="normal">{t('prio_medium')}</option>
                    <option value="low">{t('prio_low')}</option>
                  </select>
                </div>
                <div className="form-row mb-0">
                  <label className="form-label">{t('fb_field_status')}</label>
                  <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="open">{t('fb_open')}</option>
                    <option value="in_progress">{t('fb_inprogress')}</option>
                    <option value="resolved">{t('fb_resolved')}</option>
                    <option value="closed">{t('fb_closed')}</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">{t('fb_field_location')}</label>
                <select className="form-select" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                  <option value="gps">{t('fb_loc_gps')}</option>
                  <option value="qr">{t('fb_loc_qr')}</option>
                  <option value="element">{t('fb_loc_element')}</option>
                </select>
              </div>
              {(locationType === 'gps' || locationType === 'qr') && (
                <div className="form-row-grid">
                  <div>
                    <label className="form-label">{t('fb_lat')}</label>
                    <input className="form-input font-mono" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">{t('fb_lng')}</label>
                    <input className="form-input font-mono" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
                  </div>
                </div>
              )}
              {locationType === 'qr' && (
                <div className="form-row">
                  <label className="form-label">{t('fb_marker_id')}</label>
                  <input className="form-input font-mono text-sm" value={markerId} onChange={(e) => setMarkerId(e.target.value)} />
                  {fb.marker_code ? (
                    <p className="text-xs text-text-muted mt-1">{t('qr_code')}: {fb.marker_code}</p>
                  ) : null}
                </div>
              )}
              {locationType === 'element' && (
                <div className="form-row">
                  <label className="form-label">{t('ele_code')}</label>
                  <input className="form-input font-mono text-sm" value={elementGuid} onChange={(e) => setElementGuid(e.target.value)} />
                </div>
              )}
              <div className="form-row">
                <label className="form-label">{t('fb_comments')}</label>
                <div className="fb-comment-thread">
                  {comments.length === 0 ? (
                    <div className="text-xs text-text-muted">{t('fb_comments_empty')}</div>
                  ) : comments.map((c) => (
                    <div key={c.id} className="fb-comment-item">
                      <div className="font-semibold text-xs">
                        {c.user_name}
                        <span className="text-text-muted font-normal"> · {formatDateTime(c.created_at)}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                </div>
                <textarea
                  className="form-textarea min-h-[72px]"
                  value={commentText}
                  placeholder={t('fb_comment_ph')}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-p mt-2"
                  disabled={commentSending || !commentText.trim()}
                  onClick={handleSendComment}
                >
                  {commentSending ? '...' : t('fb_comment_send')}
                </button>
              </div>
              <div className="flex justify-end mb-2">
                <button type="button" className="btn btn-sm btn-s" disabled={saving} onClick={handleResolve}>
                  <Icon name="check" size={12} /> {t('st_resolved')}
                </button>
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

function bimDownloadLinks(bim) {
  const files = parseJson(bim?.model_files, {}) || {}
  const meta = parseJson(bim?.metadata, {}) || {}
  return [
    { id: 'ifc', url: files.ifc_url, labelKey: 'bd_file_ifc' },
    { id: 'glb', url: files.glb_url || files.asset_bundle_url, labelKey: 'bd_file_glb' },
    { id: 'usdz', url: files.usdz_url, labelKey: 'bd_file_usdz' },
    { id: 'meta', url: files.metadata_url || meta.metadata_url, labelKey: 'bd_file_metadata' },
  ].filter((x) => x.url)
}

function BimDetailModal({ activeModal, modalData, closeModal, openModal, toast, t, refreshData }) {
  const { isAdmin, isBql } = usePermissions()
  const canEditBim = isAdmin || isBql
  const [bim, setBim] = useState(null)
  const [versions, setVersions] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [tab, setTab] = useState('preview')
  const [loading, setLoading] = useState(false)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editVersion, setEditVersion] = useState('')
  const [editDiscipline, setEditDiscipline] = useState('architecture')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const bimId = modalData?.id
  const meta = parseJson(bim?.metadata, {}) || {}
  const gallery = useMemo(() => {
    const urls = bim ? getBimPreviewUrls(bim) : []
    return urls.length ? urls : []
  }, [bim])
  const downloads = useMemo(() => (bim ? bimDownloadLinks(bim) : []), [bim])

  const syncEditForm = useCallback((model) => {
    if (!model) return
    const m = parseJson(model.metadata, {}) || {}
    setEditName(model.name || '')
    setEditVersion(model.version || '')
    setEditDiscipline(model.discipline_code || model.discipline || 'other')
    setEditDesc(m.description || '')
  }, [])

  useEffect(() => {
    if (activeModal !== 'bim-detail' || !bimId) return
    setLoading(true)
    setTab('preview')
    setGalleryIdx(0)
    setEditing(false)
    Promise.all([
      fetchBimModel(bimId),
      fetchBimVersions(bimId, { limit: 20 }).catch(() => ({ data: [] })),
      fetchBimFeedbacks(bimId, { limit: 20 }).catch(() => ({ data: [] })),
    ])
      .then(([model, ver, fb]) => {
        setBim(model)
        syncEditForm(model)
        setVersions(ver.data || [])
        setFeedbacks(fb.data || [])
        setGalleryIdx(0)
      })
      .catch((err) => toast('err', err.message))
      .finally(() => setLoading(false))
  }, [activeModal, bimId, toast, syncEditForm])

  const handleSaveEdit = async () => {
    if (!editVersion.trim()) {
      toast('err', t('bu_need_version'))
      return
    }
    setSaving(true)
    try {
      const prevMeta = parseJson(bim?.metadata, {}) || {}
      await updateBimModel(bimId, {
        name: editName.trim() || null,
        version: editVersion.trim(),
        discipline: editDiscipline,
        metadata: { ...prevMeta, description: editDesc.trim() || undefined },
      })
      const model = await fetchBimModel(bimId)
      setBim(model)
      syncEditForm(model)
      setEditing(false)
      refreshData()
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

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
            {bim?.project_name} · {bim?.version} · {disciplineLabel(bim)} · {formatDate(bim?.uploaded_at || bim?.created_at)}
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
                  {gallery.length > 0 ? (
                    <>
                      <div className="relative aspect-[16/10] bg-border-light rounded-[10px] overflow-hidden border border-border mb-2.5">
                        <S3Image src={gallery[galleryIdx]} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2.5 right-2.5 bg-black/70 text-white px-2.5 py-1 rounded-md text-[11px] backdrop-blur-sm">
                          {galleryIdx + 1} / {gallery.length}
                        </div>
                      </div>
                      <div className={`grid gap-1.5 ${gallery.length > 4 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                        {gallery.map((src, i) => (
                          <button
                            key={src}
                            type="button"
                            className={`aspect-square bg-border-light rounded-md overflow-hidden cursor-pointer border-2 p-0 ${galleryIdx === i ? 'border-primary' : 'border-transparent'}`}
                            onClick={() => setGalleryIdx(i)}
                          >
                            <S3Image src={src} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="aspect-[16/10] bg-[#F9FAFB] border border-dashed border-border rounded-[10px] flex flex-col items-center justify-center text-center p-6 text-sm text-text-muted">
                      <Icon name="cube" size={32} className="mb-2 opacity-40" />
                      {t('bd_no_preview')}
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-2 mb-0">{t('bd_preview_hint')}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="card-sub font-semibold mb-0">{t('bd_info')}</div>
                    {canEditBim && !editing && (
                      <button
                        type="button"
                        className="btn btn-sm ml-auto"
                        onClick={() => { syncEditForm(bim); setEditing(true) }}
                      >
                        <Icon name="edit" size={14} /> {t('edit')}
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <>
                      <div className="form-row mb-3">
                        <label className="form-label">{t('bd_proj')}</label>
                        <input className="form-input bg-[#F9FAFB]" value={bim.project_name || ''} disabled />
                      </div>
                      <div className="form-row mb-3">
                        <label className="form-label">{t('bu_name')}</label>
                        <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="form-row-grid mb-3">
                        <div>
                          <label className="form-label">{t('bu_ver')} <span className="req">*</span></label>
                          <input className="form-input" value={editVersion} onChange={(e) => setEditVersion(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">{t('bu_type')}</label>
                          <DisciplineSelect value={editDiscipline} onChange={setEditDiscipline} />
                        </div>
                      </div>
                      <div className="form-row mb-3">
                        <label className="form-label">{t('bu_desc')}</label>
                        <textarea className="form-textarea min-h-[88px]" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={t('bu_desc_ph')} />
                      </div>
                      <p className="text-xs text-text-muted m-0">{t('bim_edit_hint')}</p>
                    </>
                  ) : (
                    <>
                      <ul className="info-list">
                        <li><span>{t('bd_proj')}</span><b>{bim.project_name}</b></li>
                        <li><span>{t('bd_ver')}</span><b>{bim.version}</b></li>
                        <li><span>{t('bd_type')}</span><b>{disciplineLabel(bim)}</b></li>
                        <li><span>{t('bd_date')}</span><b>{formatDateTime(bim.uploaded_at || bim.created_at)}</b></li>
                      </ul>
                      {meta.description && (
                        <div className="mt-4">
                          <div className="card-sub mb-2 font-semibold">{t('bd_desc')}</div>
                          <div className="p-3 bg-[#F9FAFB] rounded-lg text-[13px] leading-relaxed">{meta.description}</div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="mt-4">
                    <div className="card-sub mb-2 font-semibold">{t('bd_files')}</div>
                    {downloads.length === 0 ? (
                      <div className="text-xs text-text-muted">{t('bd_no_files')}</div>
                    ) : (
                      <ul className="list-none p-0 m-0 space-y-2">
                        {downloads.map(({ id, url, labelKey }) => (
                          <li key={id}>
                            <button
                              type="button"
                              className="flex items-center gap-2 text-[13px] font-medium text-primary-dark bg-transparent border-0 cursor-pointer hover:underline p-0"
                              onClick={() => openS3Url(url).catch((err) => toast('err', err.message))}
                            >
                              <Icon name="download" size={16} className="shrink-0" />
                              {t(labelKey)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {parseJson(bim.model_files, {})?.s3_prefix && (
                      <div className="text-[11px] text-text-muted font-mono mt-2 break-all">
                        S3: {parseJson(bim.model_files, {}).s3_prefix}/
                      </div>
                    )}
                  </div>
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
        {isAdmin && (
          <button type="button" className="btn btn-d" onClick={handleDelete}><Icon name="trash" size={14} /> {t('delete')}</button>
        )}
        <div className="flex-1" />
        {editing ? (
          <>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => { syncEditForm(bim); setEditing(false) }}
            >
              {t('cancel')}
            </button>
            <button type="button" className="btn btn-p" disabled={saving} onClick={handleSaveEdit}>
              {saving ? t('loading') : t('save_changes')}
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={closeModal}>{t('close')}</button>
        )}
      </div>
    </ModalOverlay>
  )
}

export default function Modals() {
  const { activeModal, modalData, closeModal, openModal, toast, refreshProjects, refreshData, dataVersion } = useApp()
  const { t } = useI18n()

  return (
    <>
      <ProfileModal activeModal={activeModal} closeModal={closeModal} t={t} toast={toast} />
      <GroupNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <GroupEditModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <GroupDetailModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} refreshProjects={refreshProjects} openModal={openModal} />
      <FeedbackNewModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <ProjectNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshProjects={refreshProjects} />
      <QrNewModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} refreshProjects={refreshProjects} openModal={openModal} />
      <QrViewModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} openModal={openModal} />
      <QrEditModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <GpsNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <GpsEditModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <UserNewModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} openModal={openModal} />
      <UserEditModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} openModal={openModal} dataVersion={dataVersion} />
      <ElementDetailModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} openModal={openModal} toast={toast} t={t} refreshData={refreshData} />
      <BimUploadModal activeModal={activeModal} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <ProjectModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshProjects={refreshProjects} openModal={openModal} dataVersion={dataVersion} />
      <FeedbackModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} toast={toast} t={t} refreshData={refreshData} />
      <BimDetailModal activeModal={activeModal} modalData={modalData} closeModal={closeModal} openModal={openModal} toast={toast} t={t} refreshData={refreshData} />
    </>
  )
}
