import { useEffect, useMemo, useState } from 'react'
import { consumeSharedPayload, detectSalePlatform, extractTitleFromShareText } from '@/lib/sharedItem'
import type { ClothePrefill } from '@/components/armario/ClotheForm'
import { Bookmark, ExternalLink, Plus, RefreshCw, Tag, X } from 'lucide-react'
import { useClothes } from '@/hooks/useClothes'
import { useCategories } from '@/hooks/useCategories'
import { useSearchStore } from '@/store/search'
import {
  generateVintedBookmarklet,
  generateWallapopBookmarklet,
  useSyncPlatform,
  type PlatformItem,
  type SyncPlatform,
} from '@/hooks/useSyncPlatform'
import { parseImport } from '@/lib/importParse'
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

const PLATFORM_CONFIG = {
  vinted: {
    label: 'Vinted',
    // URL de tu perfil de Vinted (opcional, VITE_VINTED_PROFILE_URL); por defecto, la home.
    profileUrl: import.meta.env.VITE_VINTED_PROFILE_URL ?? 'https://www.vinted.es/',
    catalogNote: 'tu perfil de Vinted',
  },
  wallapop: {
    label: 'Wallapop',
    profileUrl: 'https://es.wallapop.com/app/catalog/published',
    catalogNote: 'tu catálogo de Wallapop (wallapop.com/app/catalog/published)',
  },
}

export default function Venta() {
  const [tab, setTab] = useState<ClothesStatus>('baul')
  const { data: clothes = [], isLoading } = useClothes(['baul', 'en_venta', 'vendida', 'archivada'])
  const { data: categories = [] } = useCategories()
  const { query } = useSearchStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Clothe | null>(null)
  const [prefill, setPrefill] = useState<ClothePrefill | undefined>(undefined)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncTab, setSyncTab] = useState<SyncPlatform>('vinted')
  const [pendingItems, setPendingItems] = useState<PlatformItem[] | null>(null)
  const [pendingPlatform, setPendingPlatform] = useState<SyncPlatform>('vinted')
  const { importFromBrowser, loading: syncing, result: syncResult, error: syncError } = useSyncPlatform()

  const origin = window.location.origin

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

  // Detectar import desde bookmarklet en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vintedRaw = params.get('vinted_import')
    const wallapopRaw = params.get('wallapop_import')
    const raw = vintedRaw ?? wallapopRaw
    const platform: SyncPlatform = vintedRaw ? 'vinted' : 'wallapop'
    if (!raw) return

    window.history.replaceState({}, '', window.location.pathname)

    const items = parseImport(raw)
    if (items && items.length > 0) {
      setPendingItems(items)
      setPendingPlatform(platform)
      setSyncTab(platform)
      setSyncOpen(true)
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

  const handleImport = async () => {
    if (!pendingItems) return
    await importFromBrowser(pendingItems, pendingPlatform)
    setPendingItems(null)
    setTab('en_venta')
  }

  const handleClose = () => {
    setSyncOpen(false)
    setPendingItems(null)
  }

  const activePlatform = PLATFORM_CONFIG[syncTab]
  const bookmarkletHref = syncTab === 'vinted'
    ? generateVintedBookmarklet(origin)
    : generateWallapopBookmarklet(origin)
  const bookmarkletLabel = `Miss Outfits — ${activePlatform.label} ↗`

  return (
    <div className="px-4 pb-4 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="heading-xl">A la Venta</h1>
          <p className="text-sm text-muted mt-0.5">{STATUS_LABELS[tab]} · {counts[tab]} prendas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSyncOpen(true)}
            className="btn-secondary"
            title="Sincronizar con Vinted / Wallapop"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary">
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Modal de sincronización */}
      {syncOpen && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Sincronizar prendas</p>
            <button onClick={handleClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selector de plataforma */}
          {!pendingItems && !syncResult && (
            <div className="flex gap-1 p-1 bg-page rounded-xl">
              {(['vinted', 'wallapop'] as SyncPlatform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSyncTab(p)}
                  className={cx(
                    'flex-1 py-1.5 text-xs font-medium rounded-lg transition capitalize',
                    syncTab === p ? 'bg-surface shadow-sm text-ink' : 'text-muted',
                  )}
                >
                  {PLATFORM_CONFIG[p].label}
                </button>
              ))}
            </div>
          )}

          {/* Items pendientes de importar */}
          {pendingItems && !syncResult && (
            <div className="space-y-3">
              <div className="bg-brand-soft rounded-xl p-3 text-xs">
                <p className="font-semibold text-ink">
                  📦 {pendingItems.length} prendas de {PLATFORM_CONFIG[pendingPlatform].label} listas para importar
                </p>
                <p className="text-muted mt-0.5">Se añadirán a "En Venta" sin duplicar las ya existentes.</p>
              </div>
              <button
                onClick={handleImport}
                disabled={syncing}
                className="btn-primary w-full"
              >
                {syncing
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : `Importar ${pendingItems.length} prendas`}
              </button>
            </div>
          )}

          {/* Instrucciones del bookmarklet */}
          {!pendingItems && !syncResult && (
            <div className="space-y-3">
              <p className="text-xs text-muted leading-relaxed">
                {activePlatform.label} bloquea el acceso desde servidor. Usa este marcador para sincronizar desde tu navegador:
              </p>
              <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
                <li>Arrastra el botón de abajo a tu barra de marcadores</li>
                <li>
                  Abre{' '}
                  <a
                    href={activePlatform.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 underline inline-flex items-center gap-0.5"
                  >
                    {activePlatform.catalogNote} <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Haz clic en el marcador "{bookmarkletLabel}"</li>
                <li>Vuelves aquí automáticamente con tus prendas listas</li>
              </ol>

              <div className="flex items-center gap-3 p-3 border border-dashed border-line rounded-xl bg-surface/50">
                <Bookmark className="w-4 h-4 text-brand-700 shrink-0" />
                <a
                  href={bookmarkletHref}
                  onClick={(e) => e.preventDefault()}
                  draggable
                  className="text-xs font-semibold text-brand-700 cursor-grab select-none"
                  title="Arrastra este enlace a tu barra de marcadores"
                >
                  {bookmarkletLabel}
                </a>
                <span className="text-xs text-muted ml-auto opacity-60">← arrastra</span>
              </div>

              <p className="text-xs text-muted/60">
                Solo captura las prendas visibles en pantalla en ese momento.
              </p>
            </div>
          )}

          {syncError && (
            <p className="text-xs text-red-500">{syncError}</p>
          )}

          {syncResult && (
            <div className="bg-brand-soft rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">✅ Sincronización completada</p>
              <p className="text-muted">{syncResult.total_found} prendas encontradas · {syncResult.synced} importadas</p>
              <button onClick={handleClose} className="text-brand-700 font-medium mt-1">
                Ver en “En Venta” →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4">
        {TABS.map((t) => (
          <button key={t.status} onClick={() => setTab(t.status)}
            className={cx('px-3 py-2 rounded-xl text-sm whitespace-nowrap transition',
              tab === t.status ? 'bg-brand-700 text-white' : 'bg-surface border border-line text-ink/80')}>
            {t.label} <span className="opacity-60">{counts[t.status]}</span>
          </button>
        ))}
      </div>

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
