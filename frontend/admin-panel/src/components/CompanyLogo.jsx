import companyLogo from '../assets/2aOboQyyfq0zChWWadoOYHU7JdJIEwjkEGzbwdhQ.jpg'

/** Cắt emblem SEC (tam giác play) + chữ — emblem to hơn so với một ảnh thu nhỏ đều. */
const PRESETS = {
  header: {
    row: 'h-11 sm:h-12 md:h-14',
    mark: 'w-[3.35rem] sm:w-[3.85rem] md:w-[4.65rem]',
    text: 'h-8 sm:h-9 md:h-11',
    shift: '-ml-[3.35rem] sm:-ml-[3.85rem] md:-ml-[4.65rem]',
  },
  auth: {
    row: 'h-16 sm:h-[4.75rem]',
    mark: 'w-[4.85rem] sm:w-[5.65rem]',
    text: 'h-12 sm:h-[3.35rem]',
    shift: '-ml-[4.85rem] sm:-ml-[5.65rem]',
  },
  sidebar: {
    row: 'h-10',
    mark: 'w-[3.1rem]',
    text: 'h-8',
    shift: '-ml-[3.1rem]',
  },
}

function LogoSplit({ preset, className = '', alt = '株式会社エスイー' }) {
  const p = PRESETS[preset] || PRESETS.header
  return (
    <div className={`inline-flex items-center min-w-0 max-w-full ${p.row} ${className}`}>
      <div className={`${p.row} ${p.mark} shrink-0 overflow-hidden flex items-center`}>
        <img
          src={companyLogo}
          alt=""
          aria-hidden
          className="h-full w-auto max-w-none"
          decoding="async"
        />
      </div>
      <div className={`${p.text} overflow-hidden min-w-0 flex-1 flex items-center`}>
        <img
          src={companyLogo}
          alt={alt}
          className={`h-full w-auto max-w-none ${p.shift}`}
          decoding="async"
        />
      </div>
    </div>
  )
}

/** Logo 株式会社エスイー — header, login, menu mobile. */
export default function CompanyLogo({ preset = 'header', height, className = '', alt = '株式会社エスイー' }) {
  if (height != null) {
    const markW = Math.round(height * 1.12)
    return (
      <div className={`inline-flex items-center min-w-0 max-w-full ${className}`} style={{ height }}>
        <div className="h-full shrink-0 overflow-hidden flex items-center" style={{ width: markW }}>
          <img src={companyLogo} alt="" aria-hidden className="h-full w-auto max-w-none" decoding="async" />
        </div>
        <div className="overflow-hidden min-w-0 flex-1 flex items-center" style={{ height: height * 0.82 }}>
          <img
            src={companyLogo}
            alt={alt}
            className="h-full w-auto max-w-none"
            style={{ marginLeft: -markW }}
            decoding="async"
          />
        </div>
      </div>
    )
  }

  return <LogoSplit preset={preset} className={className} alt={alt} />
}

export { companyLogo }
