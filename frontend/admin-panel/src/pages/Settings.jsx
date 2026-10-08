import { useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { useApp } from '../context/AppContext'
import Icon from '../components/Icon'
import { fetchSettings, updateSettings } from '../api/misc'
import { fetchBackupInfo } from '../api/backup'
import { formatDateTime } from '../utils/helpers'

const TABS = [
  { id: 'general', label: 'set_tab_gen' },
  { id: 'ar', label: 'set_tab_ar' },
  { id: 'notif', label: 'set_tab_notif' },
  { id: 'integ', label: 'set_tab_int' },
  { id: 'sec', label: 'set_tab_sec' },
  { id: 'backup', label: 'set_tab_backup' },
]

function Toggle({ on, onToggle }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      className={`toggle${on ? ' on' : ''}`}
      onClick={onToggle}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      tabIndex={0}
    />
  )
}

export default function Settings() {
  const { t } = useI18n()
  const { toast } = useApp()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [backupInfo, setBackupInfo] = useState(null)
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => toast('err', t('settings_load_err')))
      .finally(() => setLoading(false))
  }, [toast, t])

  useEffect(() => {
    if (activeTab !== 'backup') return
    setBackupLoading(true)
    fetchBackupInfo()
      .then(setBackupInfo)
      .catch((err) => toast('err', err.message))
      .finally(() => setBackupLoading(false))
  }, [activeTab, toast])

  const patch = (section, key, value) => {
    setSettings((s) => ({
      ...s,
      [section]: { ...s[section], [key]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await updateSettings(settings)
      setSettings(next)
      toast('success', t('saved'))
    } catch (err) {
      toast('err', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return <div className="text-center py-12 text-text-muted">{t('loading')}</div>
  }

  const g = settings.general || {}
  const ar = settings.ar || {}
  const n = settings.notifications || {}
  const integ = settings.integrations || {}
  const sec = settings.security || {}

  return (
    <>
      <div className="page-hd">
        <div>
          <div className="page-title">{t('set_title')}</div>
          <div className="page-sub">{t('set_sub')}</div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' on' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <>
          <div className="card">
            <div className="card-title mb-4">{t('set_org')}</div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_org_name')}</label>
                <input className="form-input" value={g.org_name || ''} onChange={(e) => patch('general', 'org_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">{t('set_org_tax')}</label>
                <input className="form-input" value={g.org_tax || ''} onChange={(e) => patch('general', 'org_tax', e.target.value)} />
              </div>
            </div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_org_email')}</label>
                <input className="form-input" value={g.org_email || ''} onChange={(e) => patch('general', 'org_email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">{t('set_org_tz')}</label>
                <select className="form-select" value={g.org_tz || 'Asia/Ho_Chi_Minh'} onChange={(e) => patch('general', 'org_tz', e.target.value)}>
                  <option value="Asia/Ho_Chi_Minh">{t('tz_vn')}</option>
                  <option value="Asia/Tokyo">{t('tz_jp')}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label className="form-label">{t('set_org_addr')}</label>
              <input className="form-input" value={g.org_addr || ''} onChange={(e) => patch('general', 'org_addr', e.target.value)} />
            </div>
          </div>
          <div className="card">
            <div className="card-title mb-4">{t('set_lang_def')}</div>
            <div className="flex justify-between items-center py-3 border-b border-dashed border-border">
              <div><b>{t('set_lang_sys')}</b><div className="text-xs text-text-muted">{t('set_lang_sys_note')}</div></div>
              <select className="form-select w-[200px]" value={g.lang_sys || 'vi'} onChange={(e) => patch('general', 'lang_sys', e.target.value)}>
                <option value="vi">{t('lang_vi')}</option>
                <option value="en">{t('lang_en')}</option>
                <option value="ja">{t('lang_ja')}</option>
              </select>
            </div>
            <div className="flex justify-between items-center py-3">
              <div><b>{t('set_lang_report')}</b><div className="text-xs text-text-muted">{t('set_lang_report_note')}</div></div>
              <Toggle on={!!g.lang_report_bilingual} onToggle={() => patch('general', 'lang_report_bilingual', !g.lang_report_bilingual)} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'ar' && (
        <>
          <div className="card">
            <div className="card-title mb-4">{t('set_qr_thr')}</div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_qr_conf')}</label>
                <input className="form-input" type="number" step="0.05" value={ar.qr_confidence ?? 0.7} onChange={(e) => patch('ar', 'qr_confidence', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">{t('set_qr_timeout')}</label>
                <input className="form-input" type="number" value={ar.qr_timeout ?? 3} onChange={(e) => patch('ar', 'qr_timeout', Number(e.target.value))} />
              </div>
            </div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_qr_extended')}</label>
                <input className="form-input" type="number" value={ar.qr_extended_m ?? 15} onChange={(e) => patch('ar', 'qr_extended_m', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">{t('set_qr_size')}</label>
                <input className="form-input" type="number" value={ar.qr_min_size_cm ?? 15} onChange={(e) => patch('ar', 'qr_min_size_cm', Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-title mb-4">{t('set_gps')}</div>
            <div className="flex justify-between items-center py-3 border-b border-dashed border-border">
              <div><b>{t('set_gps_auto')}</b></div>
              <Toggle on={!!ar.gps_auto_switch} onToggle={() => patch('ar', 'gps_auto_switch', !ar.gps_auto_switch)} />
            </div>
            <div className="flex justify-between items-center py-3 border-b border-dashed border-border">
              <div><b>{t('set_gps_rtk')}</b></div>
              <Toggle on={!!ar.gps_require_rtk} onToggle={() => patch('ar', 'gps_require_rtk', !ar.gps_require_rtk)} />
            </div>
            <div className="flex justify-between items-center py-3">
              <div><b>{t('set_gps_kalman')}</b></div>
              <Toggle on={!!ar.gps_kalman} onToggle={() => patch('ar', 'gps_kalman', !ar.gps_kalman)} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'notif' && (
        <div className="card">
          <div className="card-title mb-4">{t('set_notif_ch')}</div>
          <div className="flex justify-between items-center py-3.5 border-b border-dashed border-border">
            <div className="flex items-center gap-3">
              <div className="stat-icon"><Icon name="bell" size={22} /></div>
              <div><b>{t('set_notif_push')}</b></div>
            </div>
            <Toggle on={!!n.push} onToggle={() => patch('notifications', 'push', !n.push)} />
          </div>
          <div className="flex justify-between items-center py-3.5 border-b border-dashed border-border">
            <div className="flex items-center gap-3">
              <div className="stat-icon green"><Icon name="mail" size={22} /></div>
              <div><b>{t('set_notif_email')}</b></div>
            </div>
            <Toggle on={!!n.email} onToggle={() => patch('notifications', 'email', !n.email)} />
          </div>
          <div className="flex justify-between items-center py-3.5">
            <div className="flex items-center gap-3">
              <div className="stat-icon orange"><Icon name="chat" size={22} /></div>
              <div><b>{t('set_notif_sms')}</b></div>
            </div>
            <Toggle on={!!n.sms} onToggle={() => patch('notifications', 'sms', !n.sms)} />
          </div>
        </div>
      )}

      {activeTab === 'integ' && (
        <div className="card">
          <div className="card-title mb-4">{t('set_int_ext')}</div>
          {['s3', 'ntrip', 'datadog'].map((key) => {
            const item = integ[key] || {}
            return (
              <div key={key} className="flex justify-between items-center py-3.5 border-b border-dashed border-border last:border-0">
                <div>
                  <b>{key.toUpperCase()}</b>
                  <div className="text-xs text-text-muted">{item.detail || '—'}</div>
                </div>
                <span className={`chip ${item.connected ? 'chip-green' : 'chip-yellow'}`}>
                  <span className="dot" />{item.connected ? t('set_int_connected') : t('set_int_not')}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'sec' && (
        <>
          <div className="card">
            <div className="card-title mb-4">{t('set_sec_pwd')}</div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_sec_len')}</label>
                <input className="form-input" type="number" value={sec.password_min_length ?? 8} onChange={(e) => patch('security', 'password_min_length', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">{t('set_sec_exp')}</label>
                <input className="form-input" type="number" value={sec.password_expiry_days ?? 90} onChange={(e) => patch('security', 'password_expiry_days', Number(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <div><b>{t('set_sec_special')}</b></div>
              <Toggle on={!!sec.require_special} onToggle={() => patch('security', 'require_special', !sec.require_special)} />
            </div>
            <div className="flex justify-between items-center py-2.5">
              <div><b>{t('set_sec_2fa')}</b></div>
              <Toggle on={!!sec.admin_2fa} onToggle={() => patch('security', 'admin_2fa', !sec.admin_2fa)} />
            </div>
          </div>
          <div className="card">
            <div className="card-title mb-4">{t('set_sec_sess')}</div>
            <div className="form-row-grid">
              <div>
                <label className="form-label">{t('set_sec_jwt')}</label>
                <input className="form-input" type="number" value={sec.jwt_hours ?? 24} onChange={(e) => patch('security', 'jwt_hours', Number(e.target.value))} />
              </div>
              <div>
                <label className="form-label">{t('set_sec_refresh')}</label>
                <input className="form-input" type="number" value={sec.refresh_days ?? 30} onChange={(e) => patch('security', 'refresh_days', Number(e.target.value))} />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'backup' && (
        <div className="card">
          <div className="card-title mb-2">{t('backup_title')}</div>
          <p className="text-sm text-text-muted mb-4">{t('backup_sub')}</p>
          {backupLoading ? (
            <div className="text-text-muted text-sm">{t('loading')}</div>
          ) : (
            <>
              <div className="text-sm mb-2"><b>{t('backup_dir')}:</b> <code className="text-xs">{backupInfo?.backup_dir || '—'}</code></div>
              {backupInfo?.cron_hint ? (
                <pre className="text-xs bg-[#F9FAFB] p-3 rounded-lg overflow-auto border border-border mb-4">{backupInfo.cron_hint}</pre>
              ) : null}
              <div className="font-semibold text-sm mb-2">{t('backup_files')}</div>
              {(backupInfo?.files || []).length === 0 ? (
                <div className="text-sm text-text-muted">{t('backup_empty')}</div>
              ) : (
                <ul className="info-list">
                  {backupInfo.files.map((f) => (
                    <li key={f.name}>
                      <span>{f.name}</span>
                      <b>{Math.round((f.size || 0) / 1024)} KB · {formatDateTime(f.mtime)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {activeTab !== 'backup' && (
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-p" disabled={saving} onClick={handleSave}>
            {saving ? '...' : t('save_changes')}
          </button>
        </div>
      )}
    </>
  )
}
