import { useEffect, useState } from 'react'
import { resolveS3AccessUrl } from '../api/uploads'

function isDirectUrl(src) {
  if (!src) return false
  if (src.startsWith('blob:') || src.startsWith('data:')) return true
  if (!src.includes('amazonaws.com') && !src.startsWith('uploads/') && !src.startsWith('models/') && !src.startsWith('feedbacks/')) {
    return src.startsWith('http')
  }
  return false
}

/** Image from S3 (presigned GET) or normal URL. */
export default function S3Image({ src, alt = '', className, fallback = null }) {
  const [resolved, setResolved] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setResolved(null)
    if (!src) return undefined

    if (isDirectUrl(src)) {
      setResolved(src)
      return undefined
    }

    resolveS3AccessUrl(src)
      .then((url) => {
        if (!cancelled) setResolved(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => { cancelled = true }
  }, [src])

  if (!src || failed) {
    return fallback
  }
  if (!resolved) {
    return (
      <div className={`bg-border-light animate-pulse ${className || ''}`} aria-hidden />
    )
  }
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
