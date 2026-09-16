import companyLogo from '../assets/2aOboQyyfq0zChWWadoOYHU7JdJIEwjkEGzbwdhQ-Picsart-BackgroundRemover.jpg'

/** Logo 株式会社エスイー — header, login, menu mobile. */
export default function CompanyLogo({ height, className = '', alt = '株式会社エスイー' }) {
  return (
    <img
      src={companyLogo}
      alt={alt}
      className={`object-contain object-left w-auto max-w-full ${className}`}
      style={height != null ? { height } : undefined}
      decoding="async"
    />
  )
}

export { companyLogo }
