import { useI18n, LANGS } from '../context/I18nContext'

export default function LangSwitcher({ className = '' }) {
  const { lang, setLang } = useI18n()

  return (
    <div className={`relative z-[110] flex bg-border-light rounded-lg p-0.5 gap-0.5 shrink-0 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setLang(l)
          }}
          aria-pressed={lang === l}
          className={`relative z-[1] px-2 sm:px-2.5 py-1.5 bg-transparent border-none cursor-pointer rounded-md text-xs font-semibold transition-all ${
            lang === l ? 'bg-white text-primary-dark shadow-[0_1px_3px_rgba(0,0,0,.06)]' : 'text-text-muted hover:text-text'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
