import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { forgotPassword } from '../api/auth.js'
import { ApiError } from '../api/client.js'

export default function ForgotPassword() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await forgotPassword(email)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold mb-1">{t('forgot_title')}</h1>
      <p className="text-sm text-text-muted mb-6">{t('forgot_sub')}</p>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm">{error}</div>
      )}
      {done ? (
        <p className="text-sm">{t('forgot_sent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-p w-full justify-center" disabled={submitting}>
            {submitting ? '...' : t('forgot_submit')}
          </button>
        </form>
      )}
      <p className="text-sm text-center mt-6">
        <Link to="/login" className="text-primary-dark font-semibold no-underline hover:underline">{t('login_btn')}</Link>
      </p>
    </>
  )
}
