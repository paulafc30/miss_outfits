import { useMemo, useState } from 'react'
import Modal from '@/components/shared/Modal'
import { useClothes } from '@/hooks/useClothes'
import { useOutfits } from '@/hooks/useOutfits'
import { useCreateWear, useDeleteWear, useUpdateWear, WearWithRefs } from '@/hooks/useWears'
import { useAuth } from '@/hooks/useAuth'
import { formatISODate, longDateLabel } from '@/lib/calendar'
import { cx } from '@/lib/utils'
import { Shirt, Folder, Trash2, Plus, ImageOff, X, Clock, Check } from 'lucide-react'

function formatISODateToday(): string {
  return formatISODate(new Date())
}

type AddMode = null | 'clothe' | 'outfit'

export default function DayDetailModal({
  open,
  onClose,
  iso,
  wears,
}: {
  open: boolean
  onClose: () => void
  iso: string | null
  wears: WearWithRefs[]
}) {
  const { user } = useAuth()
  const { data: closet = [] } = useClothes(['closet'])
  const { data: outfits = [] } = useOutfits()
  const createWear = useCreateWear()
  const deleteWear = useDeleteWear()
  const updateWear = useUpdateWear()

  const [addMode, setAddMode] = useState<AddMode>(null)
  const [search, setSearch] = useState('')

  const filteredClothes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return closet
    return closet.filter((c) => c.name.toLowerCase().includes(q))
  }, [closet, search])

  const filteredOutfits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return outfits
    return outfits.filter((o) => o.name.toLowerCase().includes(q))
  }, [outfits, search])

  function close() {
    setAddMode(null)
    setSearch('')
    onClose()
  }

  async function addClothe(clotheId: string) {
    if (!user || !iso) return
    await createWear.mutateAsync({ user_id: user.id, wear_date: iso, clothe_id: clotheId })
    setAddMode(null); setSearch('')
  }

  async function addOutfit(outfitId: string) {
    if (!user || !iso) return
    await createWear.mutateAsync({ user_id: user.id, wear_date: iso, outfit_id: outfitId })
    setAddMode(null); setSearch('')
  }

  if (!iso) return null

  return (
    <Modal open={open} onClose={close} title={longDateLabel(iso)}>
      <div className="space-y-4">
        {wears.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No has registrado nada en este día.</p>
        ) : (
          <ul className="space-y-2">
            {wears.map((w) => {
              const isOutfit = !!w.outfit_id
              const name = w.clothes?.name ?? w.outfits?.name ?? 'Sin nombre'
              const img = w.clothes?.image_url ?? w.outfits?.cover_image_url
              return (
                <li key={w.id} className={cx(
                  'flex items-center gap-3 p-2 rounded-xl',
                  w.planned ? 'bg-brand-soft border border-dashed border-brand-300 dark:border-brand-500/40' : 'bg-surface-soft'
                )}>
                  <div className="w-12 h-12 rounded-lg bg-surface-soft overflow-hidden flex-shrink-0">
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
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      <span className={cx('chip text-[10px]', isOutfit ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200')}>
                        {isOutfit ? <><Folder className="w-2.5 h-2.5" /> Outfit</> : <><Shirt className="w-2.5 h-2.5" /> Prenda</>}
                      </span>
                      {w.planned && (
                        <span className="chip text-[10px] bg-brand-gradient text-white">
                          <Clock className="w-2.5 h-2.5" /> Planeado
                        </span>
                      )}
                    </div>
                  </div>
                  {w.planned && (
                    <button onClick={() => updateWear.mutate({ id: w.id, planned: false })}
                      className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                      title="Marcar como llevado">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteWear.mutate(w.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {addMode === null && (
          <>
            {iso && iso >= formatISODateToday() && (
              <p className="text-xs text-muted text-center -mt-2 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" /> Lo que añadas se guardará como <strong>planeado</strong>.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAddMode('clothe')} className="btn-secondary">
                <Shirt className="w-4 h-4" /> Añadir prenda
              </button>
              <button onClick={() => setAddMode('outfit')} className="btn-secondary">
                <Folder className="w-4 h-4" /> Añadir outfit
              </button>
            </div>
          </>
        )}

        {addMode !== null && (
          <div className="border-t border-line pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <input className="input flex-1" placeholder={`Buscar ${addMode === 'clothe' ? 'prenda' : 'outfit'}…`}
                value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              <button onClick={() => { setAddMode(null); setSearch('') }} className="btn-ghost px-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
              {addMode === 'clothe' && filteredClothes.map((c) => (
                <button key={c.id} onClick={() => addClothe(c.id)}
                  className="aspect-square rounded-xl overflow-hidden bg-surface-soft relative hover:ring-2 hover:ring-brand-500 transition">
                  {c.image_url ? (
                    <img decoding="async" loading="lazy" src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted/70">
                      <ImageOff className="w-5 h-5" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] font-medium px-1.5 py-1 truncate">
                    {c.name}
                  </div>
                </button>
              ))}
              {addMode === 'outfit' && filteredOutfits.map((o) => (
                <button key={o.id} onClick={() => addOutfit(o.id)}
                  className="aspect-square rounded-xl overflow-hidden bg-surface-soft relative hover:ring-2 hover:ring-brand-500 transition flex flex-col items-center justify-center">
                  <Folder className="w-6 h-6 text-muted/70" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] font-medium px-1.5 py-1 truncate">
                    {o.name}
                  </div>
                </button>
              ))}
            </div>

            {addMode === 'clothe' && filteredClothes.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No hay prendas que coincidan.</p>
            )}
            {addMode === 'outfit' && filteredOutfits.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No hay outfits que coincidan.</p>
            )}
          </div>
        )}

        <button onClick={close} className="btn-secondary w-full">
          {addMode === null ? 'Cerrar' : 'Hecho'}
        </button>

        {addMode === null && wears.length === 0 && (
          <p className="text-xs text-muted text-center flex items-center justify-center gap-1">
            <Plus className="w-3 h-3" /> Toca un botón para empezar a registrar.
          </p>
        )}
      </div>
    </Modal>
  )
}
