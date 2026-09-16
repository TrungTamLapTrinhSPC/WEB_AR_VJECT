const S = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
}

const ICONS = {
  home: (
    <>
      <path {...S} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </>
  ),
  building: (
    <>
      <path {...S} d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path {...S} d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01M15 9h.01M15 12h.01M15 15h.01M15 18h.01" />
    </>
  ),
  cube: (
    <>
      <path {...S} d="M12 3 3 7.5 12 12l9-4.5L12 3z" />
      <path {...S} d="M3 7.5V16l9 5 9-5V7.5M12 12v9" />
    </>
  ),
  qr: (
    <>
      <rect {...S} x="3" y="3" width="7" height="7" rx="1" />
      <rect {...S} x="14" y="3" width="7" height="7" rx="1" />
      <rect {...S} x="3" y="14" width="7" height="7" rx="1" />
      <path {...S} d="M14 14h3v3h-3zM17 17h4M17 20h4M14 20h1" />
    </>
  ),
  'map-pin': (
    <>
      <path {...S} d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle {...S} cx="12" cy="10" r="3" />
    </>
  ),
  wrench: (
    <>
      <path {...S} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  chat: (
    <>
      <path {...S} d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  users: (
    <>
      <path {...S} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle {...S} cx="9" cy="7" r="4" />
      <path {...S} d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  cog: (
    <>
      <circle {...S} cx="12" cy="12" r="3" />
      <path {...S} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  history: (
    <>
      <circle {...S} cx="12" cy="12" r="9" />
      <path {...S} d="M12 7v5l3 2M3 12a9 9 0 1 0 2.5-6.2L3 8M3 3v5h5" />
    </>
  ),
  bell: (
    <>
      <path {...S} d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  search: (
    <>
      <circle {...S} cx="11" cy="11" r="8" />
      <line {...S} x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  plus: (
    <>
      <line {...S} x1="12" y1="5" x2="12" y2="19" />
      <line {...S} x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  edit: (
    <>
      <path {...S} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path {...S} d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </>
  ),
  trash: (
    <>
      <path {...S} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line {...S} x1="10" y1="11" x2="10" y2="17" />
      <line {...S} x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  eye: (
    <>
      <path {...S} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle {...S} cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path {...S} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line {...S} x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  upload: (
    <>
      <path {...S} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </>
  ),
  download: (
    <>
      <path {...S} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  menu: (
    <>
      <line {...S} x1="4" y1="7" x2="20" y2="7" />
      <line {...S} x1="4" y1="12" x2="20" y2="12" />
      <line {...S} x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  x: (
    <>
      <line {...S} x1="18" y1="6" x2="6" y2="18" />
      <line {...S} x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: (
    <>
      <circle {...S} cx="12" cy="12" r="10" />
      <polyline {...S} points="8 12 11 15 16 9" />
    </>
  ),
  alert: (
    <>
      <path {...S} d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line {...S} x1="12" y1="9" x2="12" y2="13" />
      <line {...S} x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  info: (
    <>
      <circle {...S} cx="12" cy="12" r="10" />
      <line {...S} x1="12" y1="16" x2="12" y2="12" />
      <line {...S} x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  image: (
    <>
      <rect {...S} x="3" y="3" width="18" height="18" rx="2" />
      <circle {...S} cx="8.5" cy="8.5" r="1.5" />
      <polyline {...S} points="21 15 16 10 5 21" />
    </>
  ),
  filter: (
    <>
      <polygon {...S} points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </>
  ),
  refresh: (
    <>
      <path {...S} d="M23 4v6h-6M1 20v-6h6" />
      <path {...S} d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  mail: (
    <>
      <rect {...S} x="2" y="4" width="20" height="16" rx="2" />
      <polyline {...S} points="22 6 12 13 2 6" />
    </>
  ),
  globe: (
    <>
      <circle {...S} cx="12" cy="12" r="10" />
      <line {...S} x1="2" y1="12" x2="22" y2="12" />
      <path {...S} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  'log-out': (
    <>
      <path {...S} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline {...S} points="16 17 21 12 16 7" />
      <line {...S} x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  clock: (
    <>
      <circle {...S} cx="12" cy="12" r="10" />
      <polyline {...S} points="12 6 12 12 16 14" />
    </>
  ),
  tag: (
    <>
      <path {...S} d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle {...S} cx="7" cy="7" r="1.5" />
    </>
  ),
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.75 }) {
  const content = ICONS[name]
  if (!content) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`icon-line shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  )
}

export function ToastIcon({ type, size = 16 }) {
  const map = { success: 'check', err: 'alert', warn: 'alert', info: 'info' }
  return <Icon name={map[type] || 'check'} size={size} />
}
