import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { ApiError } from '../api/client'

export default function Register() {
  const { register } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError(t('register_password_mismatch'))
      return
    }
    if (form.password.length < 6) {
      setError(t('register_password_min'))
      return
    }
    setSubmitting(true)
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        language: lang,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register_failed'))
    } finally {
      setSubmitting(false)
    }
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">{t('full_name')}</label>
          <input className="form-input" value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" className="form-input" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className="form-label">{t('password')}</label>
          <input type="password" className="form-input" value={form.password} onChange={set('password')} required minLength={6} />
        </div>
        <div>
          <label className="form-label">{t('confirm_password')}</label>
          <input type="password" className="form-input" value={form.confirm} onChange={set('confirm')} required />
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
