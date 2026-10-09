import { useState } from 'react'
import { X, ChevronDown, ChevronRight, Shirt } from 'lucide-react'
import { cx } from '@/lib/utils'
import { useSeasons, useCreateSeason, useDeleteSeason, useClotheSeasons } from '@/hooks/useSeasons'
import { useClothes } from '@/hooks/useClothes'
import type { Season, Clothe } from '@/types/database'

const SEASON_ICONS = ['🌸', '☀️', '🍂', '❄️', '💃', '🎪', '🌊', '🏔️', '🎄', '🌻']
const SEASON_COLORS = [
  '#f472b6', '#f97316', '#b45309', '#3b82f6',
  '#a855f7', '#10b981', '#ef4444', '#6366f1',
]

function SeasonFolder({
  season,
  clothes,
  clotheSeasonMap,
  onDelete,
}: {
  season: Season
  clothes: Clothe[]
  clotheSeasonMap: Record<string, string[]>
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(true)
  const seasonClothes = clothes.filter((c) => (clotheSeasonMap[c.id] ?? []).includes(season.id))

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-soft transition text-left"
      >
        <span className="text-xl">{season.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm">{season.name}</p>
          <p className="text-xs text-muted">{seasonClothes.length} prenda{seasonClothes.length !== 1 ? 's' : ''}</p>
        </div>
        {!season.is_global && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-full hover:bg-red-100 hover:text-red-600 text-muted transition"
            title="Eliminar temporada"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {open
          ? <ChevronDown className="w-4 h-4 text-muted shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          {seasonClothes.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No hay prendas asignadas a {season.name}.<br />
              Edita una prenda y selecciona esta temporada.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 mt-1">
              {seasonClothes.map((clothe) => (
                <div key={clothe.id} className="aspect-square rounded-xl overflow-hidden bg-surface-soft relative">
                  {clothe.image_url ? (
                    <img src={clothe.image_url} alt={clothe.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shirt className="w-6 h-6 text-muted/40" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                    <p className="text-white text-[9px] font-medium leading-tight line-clamp-2">{clothe.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddSeasonForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🌻')
  const [color, setColor] = useState('#a855f7')
  const { mutateAsync, isPending } = useCreateSeason()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await mutateAsync({ name: name.trim(), icon, color })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <p className="text-sm font-semibold text-ink">Nueva temporada</p>

      <div className="flex gap-2">
        <div className="space-y-1 flex-1">
          <label className="text-xs text-muted">Nombre</label>
          <input
            className="input w-full"
            placeholder="Ej: Feria, Navidad..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={30}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted">Icono</label>
        <div className="flex flex-wrap gap-1.5">
          {SEASON_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cx(
                'w-9 h-9 rounded-lg text-lg transition border-2',
                icon === ic ? 'border-brand-600 bg-brand-soft' : 'border-transparent bg-surface-soft hover:bg-surface'
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {SEASON_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cx(
                'w-7 h-7 rounded-full border-2 transition',
                color === c ? 'border-ink scale-110' : 'border-transparent'
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isPending || !name.trim()} className="btn-primary flex-1 justify-center">
          {isPending ? 'Guardando…' : 'Añadir temporada'}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

export default function SeasonTab({
  addingNew,
  onCloseAdd,
}: {
  addingNew: boolean
  onCloseAdd: () => void
}) {
  const { data: seasons = [], isLoading } = useSeasons()
  const { data: clothes = [] } = useClothes(['closet', 'baul'])
  const { data: clotheSeasonMap = {} } = useClotheSeasons()
  const { mutate: deleteSeason } = useDeleteSeason()

  if (isLoading) return <p className="text-center text-muted py-12">Cargando…</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Organiza tu armario por temporada. Edita cada prenda para asignarle varias.
      </p>

      {addingNew && <AddSeasonForm onClose={onCloseAdd} />}

      {seasons.map((season) => (
        <SeasonFolder
          key={season.id}
          season={season}
          clothes={clothes}
          clotheSeasonMap={clotheSeasonMap}
          onDelete={season.is_global ? undefined : () => deleteSeason(season.id)}
        />
      ))}
    </div>
  )
}
