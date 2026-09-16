import { useEffect, useState } from 'react'
import { useI18n } from '../context/I18nContext'
import { fetchPasswordPolicy } from '../api/auth'
import { formatRuleLabel, getRuleChecks } from '../utils/passwordPolicy'

export default function PasswordRequirements({ password }) {
  const { t } = useI18n()
  const [policy, setPolicy] = useState(null)

  useEffect(() => {
    fetchPasswordPolicy().then(setPolicy).catch(() => setPolicy(null))
  }, [])

  const rules = getRuleChecks(password, policy || undefined)

  return (
    <ul className="text-xs text-text-muted space-y-1 mt-2 mb-1 list-none p-0">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={rule.ok ? 'text-success' : ''}
        >
          <span className="inline-block w-3">{rule.ok ? '✓' : '○'}</span>
          {formatRuleLabel(t, rule)}
        </li>
      ))}
    </ul>
  )
}
