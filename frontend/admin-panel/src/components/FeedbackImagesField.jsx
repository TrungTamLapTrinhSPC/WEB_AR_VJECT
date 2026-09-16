import { useRef, useState } from 'react'
import Icon from './Icon'
import S3Image from './S3Image'
import { fetchUploadConfig, uploadToS3 } from '../api/uploads'

const MAX_IMAGES = 8

export default function FeedbackImagesField({ images, onChange, t, toast, disabled = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const list = Array.isArray(images) ? images : []

  const handlePick = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    const remaining = MAX_IMAGES - list.length
    if (remaining <= 0) {
      toast('err', t('fb_photos_max'))
      return
    }

    setUploading(true)
    try {
      const cfg = await fetchUploadConfig()
      if (!cfg.s3_enabled) {
        toast('err', t('fb_s3_required'))
        return
      }
      const batch = files.slice(0, remaining)
      const urls = [...list]
      for (const file of batch) {
        const up = await uploadToS3(file, { prefix: 'feedbacks' })
        urls.push(up.publicUrl)
      }
      onChange(urls)
    } catch (err) {
      toast('err', err.message || t('fb_upload_failed'))
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (idx) => {
    onChange(list.filter((_, i) => i !== idx))
  }

  return (
    <div className="form-row mb-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="form-label mb-0">{t('fb_photos')}</label>
        <span className="text-xs text-text-muted">{list.length}/{MAX_IMAGES}</span>
      </div>
      {list.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3 max-[500px]:grid-cols-3">
          {list.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-border-light">
              <S3Image src={url} alt="" className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  className="absolute top-1 right-1 btn-icon bg-white/90 text-danger w-7 h-7"
                  onClick={() => removeAt(idx)}
                  aria-label={t('fb_remove_photo')}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!disabled && list.length < MAX_IMAGES && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handlePick}
          />
          <button
            type="button"
            className="btn btn-sm w-full"
            disabled={uploading || disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" size={14} />
            {uploading ? t('fb_uploading') : t('fb_add_photo')}
          </button>
        </>
      )}
      {list.length === 0 && disabled && (
        <div className="text-sm text-text-muted py-2">{t('fb_no_photos')}</div>
      )}
    </div>
  )
}
