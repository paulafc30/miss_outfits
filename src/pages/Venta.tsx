// PAUSADO: la sincronización con Vinted/Wallapop (bookmarklets) está oculta hasta decidir cómo
// implementarla bien. Su UI vive, sin montar, en components/venta/PlatformSyncPanel.tsx; la lógica
// sigue en hooks/useSyncPlatform.ts y lib/importParse.ts (con tests). Siguen activos: los
// interruptores Wallapop/Vinted de cada prenda, el generador de descripciones y compartir desde
// Wallapop/Vinted (Web Share Target).
import SalesStats from '@/components/venta/SalesStats'
import { useEffect, useMemo, useState } from 'react'
import { consumeSharedPayload, detectSalePlatform, extractTitleFromShareText } from '@/lib/sharedItem'
import type { ClothePrefill } from '@/components/armario/ClotheForm'
import { Plus, Tag } from 'lucide-react'
import { useClothes } from '@/hooks/useClothes'
import { useCategories } from '@/hooks/useCategories'
import { useSearchStore } from '@/store/search'
import SaleCard from '@/components/venta/SaleCard'
import ClotheForm from '@/components/armario/ClotheForm'
import EmptyState from '@/components/shared/EmptyState'
import type { Clothe, ClothesStatus } from '@/types/database'
import { cx, STATUS_LABELS } from '@/lib/utils'

const TABS: { status: ClothesStatus; label: string }[] = [
  { status: 'baul', label: 'Baúl' },
  { status: 'en_venta', label: 'En Venta' },
  { status: 'vendida', label: 'Vendida' },
  { status: 'archivada', label: 'Archivados' },
]

export default function Venta() {
  const [tab, setTab] = useState<ClothesStatus>('baul')
  const { data: clothes = [], isLoading } = useClothes(['baul', 'en_venta', 'vendida', 'archivada'])
  const { data: categories = [] } = useCategories()
  const { query } = useSearchStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Clothe | null>(null)
  const [prefill, setPrefill] = useState<ClothePrefill | undefined>(undefined)
  // Detectar share externo (Wallapop/Vinted via Share API)
  useEffect(() => {
    const shared = consumeSharedPayload('venta')
    if (shared) {
      const platform = detectSalePlatform(shared.url)
      const titleFromText = extractTitleFromShareText(shared.text)
      setPrefill({
        name: titleFromText || shared.title || undefined,
        url: shared.url || undefined,
        platform: platform ?? undefined,
        forceStatus: platform ? 'en_venta' : undefined,
      })
      setEditing(null)
      setTab(platform ? 'en_venta' : 'baul')
      setFormOpen(true)
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<ClothesStatus, number> = { closet: 0, baul: 0, en_venta: 0, vendida: 0, archivada: 0 }
    clothes.forEach((cl) => { c[cl.status]++ })
    return c
  }, [clothes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clothes.filter((c) => {
      if (c.status !== tab) return false
      if (!q) return true
      const cat = categories.find((cc) => cc.id === c.category_id)
      const allColors = c.colors && c.colors.length > 0 ? c.colors : (c.color ? [c.color] : [])
      return c.name.toLowerCase().includes(q) ||
        (cat?.name.toLowerCase().includes(q) ?? false) ||
        (c.brand?.toLowerCase().includes(q) ?? false) ||
        allColors.some((col) => col.toLowerCase().includes(q)) ||
        (c.size?.toLowerCase().includes(q) ?? false) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    })
  }, [clothes, tab, query, categories])

  return (
    <div className="px-4 pb-4 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="heading-xl">A la Venta</h1>
          <p className="text-sm text-muted mt-0.5">{STATUS_LABELS[tab]} · {counts[tab]} prendas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
      </div>


      <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4">
        {TABS.map((t) => (
          <button key={t.status} onClick={() => setTab(t.status)}
            className={cx('px-3 py-2 rounded-xl text-sm whitespace-nowrap transition',
              tab === t.status ? 'bg-brand-700 text-white' : 'bg-surface border border-line text-ink/80')}>
            {t.label} <span className="opacity-60">{counts[t.status]}</span>
          </button>
        ))}
      </div>

      {tab === 'vendida' && !isLoading && <SalesStats sold={filtered} />}

      {isLoading ? (
        <p className="text-center text-muted py-12">Cargando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={`Sin prendas en ${STATUS_LABELS[tab]}`}
          subtitle="Mueve prendas desde tu armario o añade una nueva directamente aquí."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((c) => (
            <SaleCard key={c.id} clothe={c} onEdit={() => { setEditing(c); setFormOpen(true) }} />
          ))}
        </div>
      )}

      <ClotheForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setPrefill(undefined) }}
        clothe={editing}
        defaultStatus={tab}
        prefill={editing ? undefined : prefill}
      />
    </div>
  )
}
