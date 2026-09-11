/** Vite `base` — e.g. `/ar/` on production, `/` in dev */
export function getBasename() {
  const base = import.meta.env.BASE_URL || '/'
  const trimmed = base.replace(/\/$/, '')
  return trimmed || undefined
}

/** Absolute app path: withBase('login') → '/ar/login' */
export function withBase(path = '') {
  const base = import.meta.env.BASE_URL || '/'
  const clean = String(path).replace(/^\//, '')
  return `${base}${clean}`.replace(/\/{2,}/g, '/')
}
