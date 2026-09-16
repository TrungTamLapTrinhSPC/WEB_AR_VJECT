const DEFAULT_POLICY = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: true,
}

const SPECIAL_RE = /[^A-Za-z0-9]/

export function getRuleChecks(password, policy = DEFAULT_POLICY) {
  const p = String(password ?? '')
  return [
    {
      id: 'MIN_LENGTH',
      ok: p.length >= policy.minLength,
      labelKey: 'pwd_rule_len',
      labelParams: { n: policy.minLength },
    },
    policy.requireUpper && {
      id: 'UPPER',
      ok: /[A-Z]/.test(p),
      labelKey: 'pwd_rule_upper',
    },
    policy.requireLower && {
      id: 'LOWER',
      ok: /[a-z]/.test(p),
      labelKey: 'pwd_rule_lower',
    },
    policy.requireDigit && {
      id: 'DIGIT',
      ok: /[0-9]/.test(p),
      labelKey: 'pwd_rule_digit',
    },
    policy.requireSpecial && {
      id: 'SPECIAL',
      ok: SPECIAL_RE.test(p),
      labelKey: 'pwd_rule_special',
    },
  ].filter(Boolean)
}

export function isPasswordStrong(password, policy = DEFAULT_POLICY) {
  return getRuleChecks(password, policy).every((r) => r.ok)
}

/** @returns {string|null} i18n key of first failed rule */
export function firstPasswordErrorKey(password, policy = DEFAULT_POLICY) {
  const fail = getRuleChecks(password, policy).find((r) => !r.ok)
  return fail ? fail.labelKey : null
}

export function formatRuleLabel(t, rule) {
  if (rule.labelParams) {
    return t(rule.labelKey).replace('{n}', String(rule.labelParams.n))
  }
  return t(rule.labelKey)
}
