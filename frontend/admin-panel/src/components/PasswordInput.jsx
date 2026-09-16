import { useState } from 'react'
import Icon from './Icon'
import { useI18n } from '../context/I18nContext'

export default function PasswordInput({ className = '', ...props }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        type={visible ? 'text' : 'password'}
        className={`form-input password-field-input ${className}`.trim()}
        {...props}
      />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('pwd_hide') : t('pwd_show')}
        aria-pressed={visible}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
      </button>
    </div>
  )
}
