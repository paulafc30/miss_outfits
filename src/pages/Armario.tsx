import { useEffect, useMemo, useState } from 'react'
import { consumeSharedPayload } from '@/lib/sharedItem'
import type { ClothePrefill } from '@/components/armario/ClotheForm'
import { Plus, Settings2, Folder, Calendar as CalendarIcon, Shirt, Sparkles, Leaf } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'
import PlannedTodayBanner from '@/components/armario/PlannedTodayBanner'
import DailyOutfitsCarousel from '@/components/armario/DailyOutfitsCarousel'
import { useClothes } from '@/hooks/useClothes'
import { useCategories } from '@/hooks/useCategories'
import { useOutfits, OutfitWithItems } from '@/hooks/useOutfits'
import { useSearchStore } from '@/store/search'
import SearchFilterPanel from '@/components/shared/SearchFilterPanel'
import ClotheCard from '@/components/armario/ClotheCard'
import ClotheForm from '@/components/armario/ClotheForm'
import ClotheDetail from '@/components/armario/ClotheDetail'
import CategoryManager from '@/components/armario/CategoryManager'
import OutfitForm from '@/components/armario/OutfitForm'
import CalendarTab from '@/components/calendario/CalendarTab'
import SeasonTab from '@/components/armario/SeasonTab'
import OutfitSuggestionModal from '@/components/armario/OutfitSuggestionModal'
import type { Clothe } from '@/types/database'
import { cx } from '@/lib/utils'

type Tab = 'prendas' | 'outfits' | 'calendario' | 'temporada'

export default function Armario() {
  const [tab, setTab] = useState<Tab>('prendas')
  const { data: clothes = [], isLoading } = useClothes(['closet'])
  const { data: categories = [] } = useCategories()
  const { data: outfits = [] } = useOutfits()
  const { query, filters, setFiltersEnabled } = useSearchStore()

  // El panel de filtros (colores/talla/tejido/marca) solo existe en el DOM
  // dentro de la tab "Prendas" — avisamos a la barra de búsqueda global para
  // que solo muestre el botón de filtro mientras esté disponible.
  useEffect(() => {
    setFiltersEnabled(tab === 'prendas')
    return () => setFiltersEnabled(false)
  }, [tab, setFiltersEnabled])

  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Clothe | null>(null)
  const [prefill, setPrefill] = useState<ClothePrefill | undefined>(undefined)

  useEffect(() => {
    const shared = consumeSharedPayload('armario')
    if (shared) {
      setPrefill({
        name: shared.title || undefined,
        url: shared.url || undefined,
        notes: shared.url ? `Compartido desde: ${shared.url}` : undefined,
      })
      setEditing(null)
      setFormOpen(true)
    }
  }, [])

  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Clothe | null>(null)
  const [catModal, setCatModal] = useState(false)
  const [seasonFormOpen, setSeasonFormOpen] = useState(false)
  const [outfitFormOpen, setOutfitFormOpen] = useState(false)
  const [outfitEditing, setOutfitEditing] = useState<OutfitWithItems | null>(null)
  const [outfitSuggestOpen, setOutfitSuggestOpen] = useState(false)

  const uniqueBrands = useMemo(() =>
    [...new Set(clothes.map((c) => c.brand).filter(Boolean) as string[])].sort(),
  [clothes])

  const hasActiveSearch = !!(
    query.trim() ||
    filters.colors.length ||
    filters.sizes.length ||
    filters.materials.length ||
    filters.brands.length
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clothes.filter((c) => {
      if (filterCat && c.category_id !== filterCat) return false
      const allColors = c.colors && c.colors.length > 0 ? c.colors : (c.color ? [c.color] : [])
      if (filters.colors.length > 0 && !filters.colors.some((fc) => allColors.some((cc) => cc.toLowerCase() === fc.toLowerCase()))) return false
      if (filters.sizes.length > 0 && !filters.sizes.includes(c.size ?? '')) return false
      if (filters.materials.length > 0 && !filters.materials.some((fm) => c.material?.toLowerCase().includes(fm.toLowerCase()))) return false
      if (filters.brands.length > 0 && !filters.brands.includes(c.brand ?? '')) return false
      if (!q) return true
      const cat = categories.find((cc) => cc.id === c.category_id)
      return (
        c.name.toLowerCase().includes(q) ||
        (c.brand?.toLowerCase().includes(q) ?? false) ||
        allColors.some((col) => col.toLowerCase().includes(q)) ||
        (c.size?.toLowerCase().includes(q) ?? false) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        (cat?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [clothes, query, filterCat, filters, categories])

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  return (
    <div className="px-4 pb-4 space-y-5">
      <PlannedTodayBanner />
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="heading-xl">Miss Outfits</h1>
          <p className="text-sm text-muted mt-0.5">{clothes.length} prendas · {outfits.length} outfits</p>
        </div>
        <div className="flex gap-2">
          {tab === 'prendas' && (
            <>
              <button onClick={() => setCatModal(true)} className="btn-secondary" title="Categorías">
                <Settings2 className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </>
          )}
          {tab === 'outfits' && (
            <>
              <button onClick={() => setOutfitSuggestOpen(true)} className="btn-secondary" title="Sugerir outfit con IA">
                <Sparkles className="w-4 h-4" /> Sugerir outfit
              </button>
              <button onClick={() => { setOutfitEditing(null); setOutfitFormOpen(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> Outfit
              </button>
            </>
          )}
          {tab === 'temporada' && (
            <button onClick={() => setSeasonFormOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Temporada
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-line overflow-x-auto no-scrollbar">
        {(['prendas', 'outfits', 'temporada', 'calendario'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx('px-3 py-2 text-sm font-medium border-b-2 -mb-[1px] flex items-center gap-1.5 whitespace-nowrap shrink-0',
              tab === t ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted')}>
            {t === 'calendario' && <CalendarIcon className="w-3.5 h-3.5" />}
            {t === 'temporada' && <Leaf className="w-3.5 h-3.5" />}
            {t === 'prendas' ? 'Prendas' : t === 'outfits' ? 'Outfits' : t === 'temporada' ? 'Temporada' : 'Calendario'}
          </button>
        ))}
      </div>

      {tab === 'prendas' && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            <button onClick={() => setFilterCat(null)}
              className={cx(
                'chip whitespace-nowrap font-medium border-2 transition shrink-0',
                filterCat === null
                  ? 'bg-brand-gradient text-white border-transparent shadow-soft'
                  : 'bg-surface border-line-soft text-muted hover:text-ink'
              )}>
              Todas
            </button>
            {categories.map((c) => {
              const isActive = filterCat === c.id
              return (
                <button key={c.id} onClick={() => setFilterCat(c.id === filterCat ? null : c.id)}
                  className={cx(
                    'chip whitespace-nowrap font-medium gap-1.5 transition shrink-0 border-2',
                    isActive ? 'bg-surface text-ink shadow-soft' : 'bg-surface border-line-soft text-muted hover:text-ink'
                  )}
                  style={isActive ? { borderColor: c.color } : undefined}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  {c.name}
                </button>
              )
            })}
          </div>

          <SearchFilterPanel brands={uniqueBrands} />

          <DailyOutfitsCarousel />

          {isLoading ? (
            <p className="text-center text-muted py-12">Cargando…</p>
          ) : filtered.length === 0 && hasActiveSearch ? (
            <EmptyState
              icon={Shirt}
              title="Sin resultados"
              subtitle="No se encontraron prendas con ese criterio de búsqueda."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Shirt}
              title="Tu armario está vacío"
              subtitle="Añade la primera prenda para empezar a organizar tu ropa."
              action={
                <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary">
                  <Plus className="w-4 h-4" /> Añadir prenda
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((c) => (
                <ClotheCard key={c.id} clothe={c} category={c.category_id ? catMap[c.category_id] : undefined}
                  onClick={() => { setSelected(c); setDetailOpen(true) }} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'calendario' && <CalendarTab />}
      {tab === 'temporada' && (
        <SeasonTab addingNew={seasonFormOpen} onCloseAdd={() => setSeasonFormOpen(false)} />
      )}

      {tab === 'outfits' && (
        outfits.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No tienes outfits aún"
            subtitle="Combina prendas de tu armario en looks para tenerlos a mano."
            action={
              <button onClick={() => { setOutfitEditing(null); setOutfitFormOpen(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> Crear outfit
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {outfits.map((o) => {
              const ownPhotos = (o.image_urls ?? []).slice(0, 4)
              const previews = ownPhotos.length > 0
                ? ownPhotos
                : (o.clothe_ids.slice(0, 4)
                    .map((id) => clothes.find((c) => c.id === id)?.image_url)
                    .filter(Boolean) as string[])
              return (
                <button key={o.id} onClick={() => { setOutfitEditing(o); setOutfitFormOpen(true) }} className="card overflow-hidden text-left">
                  <div className="aspect-square grid grid-cols-2 gap-px bg-surface-soft">
                    {previews.length > 0 ? previews.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-full h-full object-cover" />
                    )) : <div className="col-span-2 row-span-2 flex items-center justify-center text-muted/50">Sin prendas</div>}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium truncate">{o.name}</p>
                    <p className="text-xs text-muted">{o.clothe_ids.length} prendas</p>
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}

      {outfitSuggestOpen && (
        <OutfitSuggestionModal onClose={() => setOutfitSuggestOpen(false)} />
      )}

      <ClotheForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setPrefill(undefined) }}
        clothe={editing}
        prefill={editing ? undefined : prefill}
      />
      <ClotheDetail open={detailOpen} onClose={() => setDetailOpen(false)} clothe={selected}
        onEdit={() => { setEditing(selected); setDetailOpen(false); setFormOpen(true) }}
        onSelectClothe={(id) => {
          const next = clothes.find((c) => c.id === id)
          if (next) setSelected(next)
        }} />
      <CategoryManager open={catModal} onClose={() => setCatModal(false)} />
      <OutfitForm open={outfitFormOpen} onClose={() => setOutfitFormOpen(false)} outfit={outfitEditing} />
    </div>
  )
}
