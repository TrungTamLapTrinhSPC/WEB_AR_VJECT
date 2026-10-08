import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { resetPassword } from '../api/auth.js'
import { ApiError } from '../api/client.js'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      setError(t('reset_missing_token'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold mb-1">{t('reset_title')}</h1>
      <p className="text-sm text-text-muted mb-6">{t('reset_sub')}</p>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm">{error}</div>
      )}
      {done ? (
        <p className="text-sm">{t('reset_done')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">{t('password')}</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-p w-full justify-center" disabled={submitting}>
            {submitting ? '...' : t('reset_submit')}
          </button>
        </form>
      )}
      <p className="text-sm text-center mt-6">
        <Link to="/login" className="text-primary-dark font-semibold no-underline hover:underline">{t('login_btn')}</Link>
      </p>
    </>
  )
}
