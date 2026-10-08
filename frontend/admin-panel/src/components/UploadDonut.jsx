/** Donut progress + ETA for chunked uploads */
export function formatUploadEta(seconds, t) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return t('bu_upload_eta_calc')
  }
  const s = Math.ceil(seconds)
  if (s < 60) return t('bu_upload_eta_sec').replace('{n}', String(s))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) {
    return t('bu_upload_eta_min').replace('{m}', String(m)).replace('{s}', String(r))
  }
  const h = Math.floor(m / 60)
  const rm = m % 60
  return t('bu_upload_eta_hour').replace('{h}', String(h)).replace('{m}', String(rm))
}

export default function UploadDonut({
  percent = 0,
  phase = 'upload',
  etaSeconds = null,
  label,
  sublabel,
  t,
}) {
  const isProcessing = phase === 'processing'
  const p = isProcessing ? 100 : Math.min(100, Math.max(0, percent))
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (p / 100) * c
  const arc = isProcessing ? c * 0.28 : c

  return (
    <div className="upload-donut-panel">
      <div className="upload-donut-wrap" role="status" aria-live="polite">
        <div className="upload-donut-ring">
          <svg className="upload-donut" viewBox="0 0 100 100" aria-hidden>
            <circle className="upload-donut-track" cx="50" cy="50" r={r} />
            <circle
              className={`upload-donut-fill${isProcessing ? ' is-processing' : ''}`}
              cx="50"
              cy="50"
              r={r}
              strokeDasharray={isProcessing ? `${arc} ${c - arc}` : c}
              strokeDashoffset={isProcessing ? 0 : offset}
            />
          </svg>
          <div className="upload-donut-center">
            <span className="upload-donut-pct">{isProcessing ? '…' : `${Math.round(p)}%`}</span>
          </div>
        </div>
        <div className="upload-donut-meta">
          <div className="upload-donut-label">{label}</div>
          {sublabel && <div className="upload-donut-sub">{sublabel}</div>}
          <div className="upload-donut-eta">
            {isProcessing
              ? t('bu_upload_eta_process')
              : formatUploadEta(etaSeconds, t)}
          </div>
        </div>
      </div>
    </div>
  )
}
