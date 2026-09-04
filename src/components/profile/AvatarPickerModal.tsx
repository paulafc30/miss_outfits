import { useRef } from 'react'
import { Camera } from 'lucide-react'
import Modal from '@/components/shared/Modal'
import { cx } from '@/lib/utils'

const PRESET_AVATARS = ['/avatars/avatar-1.svg', '/avatars/avatar-2.svg', '/avatars/avatar-3.svg']

export default function AvatarPickerModal({
  open,
  onClose,
  onPickFile,
  onPickPreset,
  currentAvatarUrl,
  uploading = false,
}: {
  open: boolean
  onClose: () => void
  onPickFile: (file: File) => void
  onPickPreset: (url: string) => void
  currentAvatarUrl: string | null
  uploading?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Modal open={open} onClose={onClose} title="Foto de perfil">
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary w-full justify-center"
        >
          <Camera className="w-4 h-4" /> {uploading ? 'Subiendo…' : 'Subir tu foto'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickFile(f)
            if (inputRef.current) inputRef.current.value = ''
          }}
        />

        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            O elige un muñeco
          </p>
          <div className="grid grid-cols-3 gap-3">
            {PRESET_AVATARS.map((src) => {
              const active = currentAvatarUrl === src
              return (
                <button
                  key={src}
                  type="button"
                  disabled={uploading}
                  onClick={() => onPickPreset(src)}
                  className={cx(
                    'aspect-square rounded-2xl overflow-hidden border-2 transition',
                    active ? 'border-brand-600 shadow-lift' : 'border-line hover:border-brand-300'
                  )}
                >
                  <img src={src} alt="Avatar" className="w-full h-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
