import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { ApiError } from '../api/client'
import PasswordInput from '../components/PasswordInput'

export default function Login() {
  const { login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password, rememberMe)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setError(t('login_verify_required'))
      } else {
        setError(err instanceof ApiError ? err.message : t('login_failed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold mb-1">{t('login_title')}</h1>
      <p className="text-sm text-text-muted mb-6">{t('login_sub')}</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm border-l-[3px] border-l-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@pa3.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="form-label">{t('password')}</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            {t('login_remember')}
          </label>
          <Link to="/forgot-password" className="text-primary-dark no-underline hover:underline">
            {t('login_forgot')}
          </Link>
        </div>
        <button type="submit" className="btn btn-p w-full justify-center" disabled={submitting}>
          {submitting ? t('login_submitting') : t('login_btn')}
        </button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        {t('login_no_account')}{' '}
        <Link to="/register" className="text-primary-dark font-semibold no-underline hover:underline">
          {t('login_register_link')}
        </Link>
      </p>
    </>
  )
}
