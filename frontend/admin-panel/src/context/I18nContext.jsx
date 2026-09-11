import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { I18N } from '../data/i18n'

const I18nContext = createContext(null)
const STORAGE_KEY = 'pa3_lang'
export const LANGS = ['vi', 'en', 'ja']

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && LANGS.includes(stored)) return stored
  } catch { /* private mode */ }
  return 'vi'
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return
    setLangState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch { /* private mode */ }
  }, [lang])

  const t = useCallback(
    (key) => (I18N[lang] && I18N[lang][key]) || I18N.vi?.[key] || key,
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
