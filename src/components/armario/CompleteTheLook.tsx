import { Sparkles, Plus } from 'lucide-react'
import type { CompleteLookSuggestion } from '@/lib/completeLook'

export default function CompleteTheLook({
  suggestions,
  onSelect,
}: {
  suggestions: CompleteLookSuggestion[]
  /** Si se pasa, cada tarjeta se convierte en botón "añadir" (usado en OutfitForm). */
  onSelect?: (clotheId: string) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5" /> Completa tu look
      </p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {suggestions.map(({ clothe }) => (
          <button
            key={clothe.id}
            type="button"
            onClick={() => onSelect?.(clothe.id)}
            disabled={!onSelect}
            title={clothe.name}
            className="relative shrink-0 w-20 text-left group"
          >
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-soft">
              {clothe.image_url ? (
                <img src={clothe.image_url} alt={clothe.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted/40 text-[10px] text-center px-1">
                  Sin foto
                </div>
              )}
            </div>
            {onSelect && (
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-soft">
                <Plus className="w-3 h-3" />
              </span>
            )}
            <p className="text-[11px] text-muted truncate mt-1">{clothe.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
