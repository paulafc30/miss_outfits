import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { cx } from '@/lib/utils'

export default function ProfileHeader({
  username,
  email,
  avatarUrl,
  uploading = false,
  onOpenPicker,
}: {
  username: string
  email: string
  avatarUrl: string | null
  uploading?: boolean
  onOpenPicker?: () => void
}) {
  const display = username?.trim() || email.split('@')[0] || 'Tú'
  const initial = (display[0] ?? '?').toUpperCase()
  const [imgError, setImgError] = useState(false)

  const showImage = avatarUrl && !imgError

  return (
    <div className="flex flex-col items-center text-center pt-2 pb-4">
      <div className="relative">
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={!onOpenPicker || uploading}
          className={cx(
            'w-24 h-24 rounded-3xl overflow-hidden shadow-lift relative flex items-center justify-center',
            'transition group',
            onOpenPicker ? 'cursor-pointer hover:opacity-95' : 'cursor-default',
            !showImage && 'bg-brand-gradient text-white text-4xl font-extrabold'
          )}
          aria-label={onOpenPicker ? 'Cambiar foto de perfil' : undefined}
        >
          {showImage ? (
            <img
              src={avatarUrl!}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span>{initial}</span>
          )}

          {onOpenPicker && (
            <span
              className={cx(
                'absolute inset-0 bg-black/40 flex items-center justify-center transition',
                uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </span>
          )}
        </button>
      </div>

      <h1 className="heading-lg mt-3 truncate max-w-full">{display}</h1>
      {username && <p className="text-sm text-muted mt-0.5 truncate max-w-full">{email}</p>}
    </div>
  )
}
