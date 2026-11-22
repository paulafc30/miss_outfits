import { useState } from 'react'
import { Sun, Dumbbell, Moon, Loader2, Shirt, Sparkles, BookmarkPlus, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useDailyOutfits, useRateDailyOutfit, type DailyOccasion, type DailyOutfit } from '@/hooks/useDailyOutfits'
import { useAuth } from '@/hooks/useAuth'
import { useCreateOutfit } from '@/hooks/useOutfits'
import { cx } from '@/lib/utils'

const DAILY_OCCASIONS: DailyOccasion[] = ['casual', 'gym', 'cena']

const OCCASION_META: Record<DailyOccasion, { label: string; icon: typeof Sun }> = {
  casual: { label: 'Casual', icon: Sun },
  gym: { label: 'Gym', icon: Dumbbell },
  cena: { label: 'Salir de noche', icon: Moon },
}

/** Collage a pantalla completa con las prendas del outfit, estilo "story". */
function OutfitCollage({ items }: { items: DailyOutfit['items'] }) {
  const shown = items.slice(0, 4)
  const extra = items.length - shown.length

  // Fondo claro fijo (no el color de la prenda) — evita que el hueco que
  // deja object-contain se vea negro cuando la prenda es oscura.
  const CELL_BG = '#F3EDE8'

  function Photo({ item, className = '' }: { item: DailyOutfit['items'][number]; className?: string }) {
    if (item.image_url) {
      return (
        <div
          className={cx('w-full h-full flex items-center justify-center p-2', className)}
          style={{ backgroundColor: CELL_BG }}
        >
          {/* object-contain (no cover): se ve la prenda entera, sin recortarla */}
          <img decoding="async" loading="lazy"
            src={item.image_url}
            alt={item.name}
            className="max-w-full max-h-full object-contain rounded-[8px]"
          />
        </div>
      )
    }
    return (
      <div
        className={cx('w-full h-full flex flex-col items-center justify-center gap-1.5 p-2', className)}
        style={{ backgroundColor: CELL_BG }}
      >
        <Shirt className="w-8 h-8 text-ink/30" />
        <span className="text-[10px] text-ink/50 text-center leading-tight line-clamp-2">{item.name}</span>
      </div>
    )
  }

  if (shown.length === 0) {
    return <div className="w-full h-full bg-surface-soft" />
  }
  if (shown.length === 1) {
    return <Photo item={shown[0]} />
  }
  if (shown.length === 2) {
    return (
      <div className="w-full h-full grid grid-cols-2 gap-0.5">
        <Photo item={shown[0]} />
        <Photo item={shown[1]} />
      </div>
    )
  }
  if (shown.length === 3) {
    return (
      <div className="w-full h-full grid grid-cols-2 gap-0.5">
        <Photo item={shown[0]} className="row-span-2" />
        <div className="grid grid-rows-2 gap-0.5 h-full">
          <Photo item={shown[1]} />
          <Photo item={shown[2]} />
        </div>
      </div>
    )
  }
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
      {shown.map((item, i) => (
        <div key={item.id} className="relative">
          <Photo item={item} />
          {i === 3 && extra > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">+{extra}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DailyOutfitCard({ outfit }: { outfit: DailyOutfit }) {
  const meta = OCCASION_META[outfit.occasion]
  const Icon = meta.icon
  const { user } = useAuth()
  const createOutfit = useCreateOutfit()
  const rateOutfit = useRateDailyOutfit()
  const [saved, setSaved] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [flaggedIds, setFlaggedIds] = useState<string[]>([])
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

  const handleThumbsUp = () => {
    const next = outfit.rating === 'positive' ? null : 'positive'
    setFlagging(false)
    rateOutfit.mutate({ date: outfit.date, occasion: outfit.occasion, rating: next })
  }

  const handleThumbsDown = () => {
    if (outfit.rating === 'negative') {
      // Ya estaba marcado negativo — tocar de nuevo lo quita.
      rateOutfit.mutate({ date: outfit.date, occasion: outfit.occasion, rating: null })
      return
    }
    // Antes de guardar el negativo, preguntamos qué prenda concreta falló.
    setFlaggedIds([])
    setFlagging(true)
  }

  const toggleFlag = (id: string) => {
    setFlaggedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  const confirmNegative = () => {
    rateOutfit.mutate({ date: outfit.date, occasion: outfit.occasion, rating: 'negative', dislikedItemIds: flaggedIds })
    setFlagging(false)
  }

  return (
    <div className="relative w-[80%] shrink-0 snap-center sm:w-full sm:shrink sm:snap-align-none aspect-[3/4.5] rounded-3xl overflow-hidden shadow-soft">
      <div className="absolute inset-0" style={{ backgroundColor: '#F3EDE8' }}>
        <OutfitCollage items={outfit.items} />
      </div>

      {/* Degradados para legibilidad del texto arriba y abajo */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

      {/* Cabecera: ocasión + clima */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-white bg-white/30 border border-white/30 px-2.5 py-1 rounded-full">
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
        {outfit.weather && (
          <span className="text-[11px] font-medium text-white bg-white/30 border border-white/30 px-2 py-1 rounded-full">
            {outfit.weather.split(',')[0]}
          </span>
        )}
      </div>

      {/* Pie: nombre, motivo, puntuar y guardar */}
      <div className="absolute bottom-0 inset-x-0 p-4 space-y-2.5">
        <div>
          <p className="text-lg font-semibold text-white leading-tight">{outfit.name}</p>
          <p className="text-xs text-white/80 leading-relaxed line-clamp-2 mt-0.5">{outfit.reason}</p>
        </div>

        {naming ? (
          <div className="space-y-2 bg-black/55 rounded-xl p-2.5 border border-white/20">
            <p className="text-[11px] text-white/90 font-medium">Nombre del outfit</p>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
              className="w-full text-sm rounded-lg px-2.5 py-1.5 bg-white/90 text-neutral-900 placeholder:text-neutral-500 outline-none"
              placeholder={outfit.name}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmSave}
                disabled={createOutfit.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-1.5 bg-white/90 text-neutral-900 hover:bg-white transition"
              >
                {createOutfit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setNaming(false)}
                className="text-xs font-medium rounded-lg py-1.5 px-3 text-white/80 hover:text-white transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : flagging ? (
          <div className="space-y-2 bg-black/55 rounded-xl p-2.5 border border-white/20">
            <p className="text-[11px] text-white/90 font-medium">¿Qué prenda no encajaba? (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {outfit.items.map((item) => {
                const isFlagged = flaggedIds.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleFlag(item.id)}
                    className={cx(
                      'text-[11px] font-medium px-2 py-1 rounded-full border transition',
                      isFlagged
                        ? 'bg-red-500/80 border-red-300/60 text-white'
                        : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                    )}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmNegative}
                disabled={rateOutfit.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-1.5 bg-white/90 text-neutral-900 hover:bg-white transition"
              >
                {rateOutfit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setFlagging(false)}
                className="text-xs font-medium rounded-lg py-1.5 px-3 text-white/80 hover:text-white transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleThumbsUp}
              disabled={rateOutfit.isPending}
              title="Me gusta este outfit"
              className={cx(
                'flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl py-2 px-3 border transition',
                outfit.rating === 'positive'
                  ? 'bg-green-500/80 border-green-300/60 text-white'
                  : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
              )}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleThumbsDown}
              disabled={rateOutfit.isPending}
              title="No me gusta este outfit"
              className={cx(
                'flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl py-2 px-3 border transition',
                outfit.rating === 'negative'
                  ? 'bg-red-500/80 border-red-300/60 text-white'
                  : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
              )}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saved || createOutfit.isPending}
              className={cx(
                'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl py-2 border transition',
                saved
                  ? 'bg-green-500/20 border-green-300/40 text-white cursor-default'
                  : 'bg-white/15 border-white/30 text-white hover:bg-white/25'
              )}
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Guardado
                </>
              ) : createOutfit.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" /> Guardar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MissingOutfitCard({ occasion, onRetry, retrying }: { occasion: DailyOccasion; onRetry: () => void; retrying: boolean }) {
  const meta = OCCASION_META[occasion]
  const Icon = meta.icon
  return (
    <div className="relative w-[80%] shrink-0 snap-center sm:w-full sm:shrink sm:snap-align-none aspect-[3/4.5] rounded-3xl overflow-hidden border border-dashed border-line bg-surface-soft flex flex-col items-center justify-center gap-3 p-4 text-center">
      <Icon className="w-8 h-8 text-muted/50" />
      <div>
        <p className="text-sm font-medium text-ink">{meta.label}</p>
        <p className="text-xs text-muted mt-0.5">No se pudo generar este outfit hoy.</p>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="flex items-center gap-1.5 text-xs font-medium rounded-xl px-3 py-1.5 border border-brand-200 text-brand-700 bg-transparent hover:bg-brand-soft transition"
      >
        {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Reintentar
      </button>
    </div>
  )
}

export default function DailyOutfitsCarousel() {
  const { data: outfits, isLoading, isFetching, error, refetch } = useDailyOutfits()

  const byOccasion = Object.fromEntries((outfits ?? []).map((o) => [o.occasion, o]))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-brand-700" />
        Outfit que te sugiero para hoy
      </p>

      {isLoading && (
        <div className="card p-6 flex items-center justify-center gap-2 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Preparando tus looks de hoy...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="card p-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          No se pudieron cargar los outfits de hoy: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
          {DAILY_OCCASIONS.map((occasion) =>
            byOccasion[occasion] ? (
              <DailyOutfitCard key={occasion} outfit={byOccasion[occasion]} />
            ) : (
              <MissingOutfitCard key={occasion} occasion={occasion} onRetry={() => refetch()} retrying={isFetching} />
            )
          )}
        </div>
      )}
    </div>
  )
}
