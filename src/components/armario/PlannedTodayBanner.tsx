import { useState } from 'react'
import { CalendarCheck, Check, ImageOff, X, Shirt, Folder } from 'lucide-react'
import { useTodayPlannedWears, useUpdateWear } from '@/hooks/useWears'
import { cx } from '@/lib/utils'

/**
 * Banner que aparece en la cabecera de Miss Outfits cuando hay outfits o
 * prendas planeadas para hoy. Permite confirmarlas como llevadas (quita
 * el flag planned) o descartar el aviso (solo en la sesión actual).
 */
export default function PlannedTodayBanner() {
  const { data: planned = [], isLoading } = useTodayPlannedWears()
  const updateWear = useUpdateWear()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = planned.filter((w) => !dismissed.has(w.id))
  if (isLoading || visible.length === 0) return null

  async function markAsWorn(id: string) {
    await updateWear.mutateAsync({ id, planned: false })
  }

  return (
    <div className="card-glass rounded-2xl p-4 border-2 border-brand-200 dark:border-brand-500/30 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-gradient text-white flex items-center justify-center shadow-soft shrink-0">
          <CalendarCheck className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink leading-tight">Tu look de hoy</h3>
          <p className="text-xs text-muted leading-tight">
            {visible.length === 1
              ? 'Esto es lo que planificaste llevar hoy.'
              : `Tienes ${visible.length} cosas planeadas para hoy.`}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((w) => {
          const isOutfit = !!w.outfit_id
          const name = w.clothes?.name ?? w.outfits?.name ?? 'Sin nombre'
          const img = w.clothes?.image_url ?? w.outfits?.cover_image_url
          return (
            <li key={w.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface">
              <div className="w-12 h-12 rounded-lg bg-surface-soft overflow-hidden shrink-0">
                {img ? (
                  <img decoding="async" loading="lazy" src={img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted/70">
                    {isOutfit ? <Folder className="w-5 h-5" /> : <ImageOff className="w-5 h-5" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <span className={cx(
                  'chip text-[10px] mt-0.5',
                  isOutfit
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
                )}>
                  {isOutfit
                    ? <><Folder className="w-2.5 h-2.5" /> Outfit</>
                    : <><Shirt className="w-2.5 h-2.5" /> Prenda</>}
                </span>
              </div>
              <button
                onClick={() => markAsWorn(w.id)}
                className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
                title="Marcar como llevado"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDismissed((s) => new Set([...s, w.id]))}
                className="p-2 rounded-lg hover:bg-surface-soft text-muted transition"
                title="Descartar aviso por ahora"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
