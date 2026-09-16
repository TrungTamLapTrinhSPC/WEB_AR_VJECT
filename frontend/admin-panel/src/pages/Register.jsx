import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { verifyEmail, resendVerification, getMe } from '../api/auth'
import { fetchCompanyGroups } from '../api/companyGroups'
import { ApiError, clearTokens } from '../api/client'
import PasswordInput from '../components/PasswordInput'
import PasswordRequirements from '../components/PasswordRequirements'
import { fetchPasswordPolicy } from '../api/auth'
import { formatRuleLabel, getRuleChecks, isPasswordStrong } from '../utils/passwordPolicy'

export default function Register() {
  const { register, setUser } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [step, setStep] = useState('form')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', company_group_id: '' })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passwordPolicy, setPasswordPolicy] = useState(null)

  useEffect(() => {
    fetchCompanyGroups().then((r) => setGroups(r.data || [])).catch(() => setGroups([]))
    fetchPasswordPolicy().then(setPasswordPolicy).catch(() => setPasswordPolicy(null))
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError(t('register_password_mismatch'))
      return
    }
    if (!isPasswordStrong(form.password, passwordPolicy || undefined)) {
      const fail = getRuleChecks(form.password, passwordPolicy || undefined).find((r) => !r.ok)
      setError(fail ? formatRuleLabel(t, fail) : t('register_password_min'))
      return
    }
    setSubmitting(true)
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        language: lang,
        company_group_id: form.company_group_id || undefined,
      })
      clearTokens()
      setRegisteredEmail(form.email.trim().toLowerCase())
      setStep('verify')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await verifyEmail(registeredEmail, code.trim())
      const me = await getMe()
      setUser(me)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('verify_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    try {
      await resendVerification(registeredEmail)
      setError('')
      alert(t('verify_resent'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('verify_failed'))
    }
  }

  if (step === 'verify') {
    return (
      <>
        <h1 className="text-xl font-bold mb-1">{t('verify_title')}</h1>
        <p className="text-sm text-text-muted mb-6">{t('verify_sub')} <b>{registeredEmail}</b></p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm border-l-[3px] border-l-danger">
            {error}
          </div>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="form-label">{t('verify_code')}</label>
            <input
              className="form-input font-mono tracking-widest text-center text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>
          <button type="submit" className="btn btn-p w-full justify-center" disabled={submitting || code.length < 6}>
            {submitting ? t('verify_submitting') : t('verify_btn')}
          </button>
        </form>
        <button type="button" className="btn w-full mt-3 justify-center" onClick={handleResend}>
          {t('verify_resend')}
        </button>
      </>
    )
  }

  return (
    <>
      <h1 className="text-xl font-bold mb-1">{t('register_title')}</h1>
      <p className="text-sm text-text-muted mb-6">{t('register_sub')}</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm border-l-[3px] border-l-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="form-label">{t('full_name')}</label>
          <input className="form-input" value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" className="form-input" value={form.email} onChange={set('email')} required />
        </div>
        {groups.length > 0 && (
          <div>
            <label className="form-label">{t('user_company_group')}</label>
            <select className="form-select" value={form.company_group_id} onChange={set('company_group_id')}>
              <option value="">{t('all')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="form-label">{t('password')}</label>
          <PasswordInput value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          <PasswordRequirements password={form.password} />
        </div>
        <div>
          <label className="form-label">{t('confirm_password')}</label>
          <PasswordInput value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
        </div>
        <button type="submit" className="btn btn-p w-full justify-center" disabled={submitting}>
          {submitting ? t('register_submitting') : t('register_btn')}
        </button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        {t('register_has_account')}{' '}
        <Link to="/login" className="text-primary-dark font-semibold no-underline hover:underline">
          {t('login_btn')}
        </Link>
      </p>
    </>
  )
}
