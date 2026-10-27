import { useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw, Shirt, BookmarkPlus, Check } from 'lucide-react'
import { cx } from '@/lib/utils'
import { useOutfitSuggestion, type SuggestedOccasion, type SuggestedOutfit } from '@/hooks/useOutfitSuggestion'
import { useAuth } from '@/hooks/useAuth'
import { useCreateOutfit } from '@/hooks/useOutfits'

const OCCASIONS: { value: SuggestedOccasion; label: string; icon: string }[] = [
  { value: 'casual', label: 'Casual', icon: 'ti-sun' },
  { value: 'trabajo', label: 'Trabajo', icon: 'ti-briefcase' },
  { value: 'cena', label: 'Cena', icon: 'ti-moon' },
  { value: 'gym', label: 'Gym', icon: 'ti-run' },
  { value: 'evento', label: 'Evento', icon: 'ti-star' },
]

function ItemThumb({ item }: { item: { name: string; image_url: string | null; colors: string[] } }) {
  const bg = item.colors?.[0] ?? '#e5e3df'
  if (item.image_url) {
    return (
      <div className="aspect-square rounded-lg overflow-hidden border border-line">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className="aspect-square rounded-lg border border-line flex flex-col items-center justify-center gap-0.5 p-1"
      style={{ backgroundColor: bg + '33' }}
    >
      <Shirt className="w-4 h-4 text-ink/40" />
      <span className="text-[9px] text-ink/50 text-center leading-tight line-clamp-2">{item.name}</span>
    </div>
  )
}

function OutfitCard({ outfit, index }: { outfit: SuggestedOutfit; index: number }) {
  const { user } = useAuth()
  const createOutfit = useCreateOutfit()
  const [saved, setSaved] = useState(false)
  const [naming, setNaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(outfit.name)

  const handleSaveClick = () => {
    if (saved) return
    setNameDraft(outfit.name)
    setNaming(true)
  }

  const confirmSave = () => {
    if (!user || saved) return
    const finalName = nameDraft.trim() || outfit.name
    createOutfit.mutate(
      { user_id: user.id, name: finalName, clothe_ids: outfit.items.map((i) => i.id) },
      { onSuccess: () => { setSaved(true); setNaming(false) } }
    )
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{outfit.name}</p>
        <span className="text-[10px] text-muted bg-surface px-2 py-0.5 rounded-full border border-line">
          {index + 1} de 3
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {outfit.items.slice(0, 4).map((item) => (
          <ItemThumb key={item.id} item={item} />
        ))}
        {outfit.items.length > 4 && (
          <div className="aspect-square rounded-lg border border-line bg-surface flex items-center justify-center">
            <span className="text-xs text-muted">+{outfit.items.length - 4}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted leading-relaxed">{outfit.reason}</p>

      {naming ? (
        <div className="space-y-2 p-2.5 rounded-xl bg-surface-soft border border-line-soft">
          <p className="text-[11px] text-muted font-medium">Nombre del outfit</p>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
            className="input text-sm"
            placeholder={outfit.name}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmSave}
              disabled={createOutfit.isPending}
              className="btn-primary flex-1 justify-center text-xs py-1.5"
            >
              {createOutfit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="btn-ghost text-xs py-1.5 px-3"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleSaveClick}
          disabled={saved || createOutfit.isPending}
          className={cx(
            'w-full flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl py-1.5 border transition',
            saved
              ? 'bg-green-50 dark:bg-green-500/10 border-green-200 text-green-700 cursor-default'
              : 'btn-secondary'
          )}
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5" /> Guardado en Outfits
            </>
          ) : createOutfit.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5" /> Guardar en Outfits
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default function OutfitSuggestionModal({ onClose }: { onClose: () => void }) {
  const [selectedOccasion, setSelectedOccasion] = useState<SuggestedOccasion>('casual')
  const { suggest, loading, outfits, error, reset } = useOutfitSuggestion()

  const handleSuggest = () => suggest(selectedOccasion)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
    <div className="card p-6 space-y-4 w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand-700" />
          Sugerir outfit
        </p>
        <button onClick={onClose} className="btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!outfits && !loading && (
        <>
          <div className="space-y-2">
            <p className="text-xs text-muted">Ocasión</p>
            <div className="grid grid-cols-5 gap-1">
              {OCCASIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSelectedOccasion(o.value)}
                  className={cx(
                    'flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-medium transition border',
                    selectedOccasion === o.value
                      ? 'bg-brand-soft text-brand-700 border-brand-200'
                      : 'bg-surface text-muted border-line hover:border-muted/40'
                  )}
                >
                  <i className={cx('ti', o.icon, 'text-base')} aria-hidden="true" />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted/60">
            El clima se detecta automaticamente por tu ubicacion. Solo usa prendas de tu armario (no las que estan en venta).
          </p>

          <button onClick={handleSuggest} className="btn-primary w-full justify-center">
            <Sparkles className="w-4 h-4" />
            Sugerir outfit para hoy
          </button>
        </>
      )}

      {loading && (
        <div className="py-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-7 h-7 text-brand-700 animate-spin" />
          <div>
            <p className="text-sm font-medium text-ink">Ada está combinando tu armario…</p>
            <p className="text-xs text-muted mt-0.5">Esto tarda unos segundos</p>
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
          <button onClick={reset} className="btn-secondary w-full justify-center text-sm">
            Volver a intentar
          </button>
        </div>
      )}

      {outfits && outfits.length > 0 && (
        <div className="space-y-3">
          {outfits.map((outfit, i) => (
            <OutfitCard key={i} outfit={outfit} index={i} />
          ))}
          <button onClick={reset} className="btn-secondary w-full justify-center text-sm">
            <RefreshCw className="w-4 h-4" /> Pedir otros outfits
          </button>
        </div>
      )}
    </div>
    </div>
  )
}
