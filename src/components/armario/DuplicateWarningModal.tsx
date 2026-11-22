import Modal from '@/components/shared/Modal'
import { AlertTriangle, ImageOff } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/utils'
import type { DuplicateMatch } from '@/lib/duplicates'

/** Aviso al guardar una prenda que se parece a otra que ya tienes. */
export default function DuplicateWarningModal({
  open,
  matches,
  onCancel,
  onSaveAnyway,
  saving,
}: {
  open: boolean
  matches: DuplicateMatch[]
  onCancel: () => void
  onSaveAnyway: () => void
  saving?: boolean
}) {
  return (
    <Modal open={open} onClose={onCancel} title="¿Ya la tienes?">
      <div className="space-y-4">
        <p className="text-sm text-muted flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          Esta prenda se parece a {matches.length === 1 ? 'una que ya tienes' : 'otras que ya tienes'}.
          Mira si es la misma antes de guardarla.
        </p>

        <ul className="space-y-2">
          {matches.map(({ clothe, reasons }) => (
            <li key={clothe.id} className="card p-2 flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-soft shrink-0">
                {clothe.image_url ? (
                  <img src={clothe.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-6 h-6 text-muted/50" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{clothe.name}</p>
                <p className="text-xs text-muted truncate">
                  {[clothe.brand, STATUS_LABELS[clothe.status]].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                  {reasons.slice(0, 3).join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary flex-1 justify-center">
            Es la misma, no guardar
          </button>
          <button type="button" onClick={onSaveAnyway} disabled={saving} className="btn-primary flex-1 justify-center">
            Es otra, guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
