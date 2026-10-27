// PAUSADO: panel de sincronización con Vinted/Wallapop. NO está montado en ninguna página
// (ver pages/Venta.tsx). Se conserva aquí, compilando y tipado, para reactivarlo cuando esté
// claro cómo debe funcionar. Para activarlo: renderiza <PlatformSyncPanel /> en Venta.tsx
// (p. ej. tras el botón "Sincronizar") y llama a useBookmarkletImport() para abrirlo al volver
// del marcador.
import { useEffect, useState } from 'react'
import { Bookmark, ExternalLink, RefreshCw, X } from 'lucide-react'
import {
  generateVintedBookmarklet,
  generateWallapopBookmarklet,
  useSyncPlatform,
  type PlatformItem,
  type SyncPlatform,
} from '@/hooks/useSyncPlatform'
import { parseImport } from '@/lib/importParse'
import { cx } from '@/lib/utils'

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

/** Detecta en la URL el import devuelto por el marcador (?vinted_import= / ?wallapop_import=). */
export function useBookmarkletImport() {
  const [pending, setPending] = useState<{ items: PlatformItem[]; platform: SyncPlatform } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const vintedRaw = params.get('vinted_import')
    const wallapopRaw = params.get('wallapop_import')
    const raw = vintedRaw ?? wallapopRaw
    const platform: SyncPlatform = vintedRaw ? 'vinted' : 'wallapop'
    if (!raw) return

    window.history.replaceState({}, '', window.location.pathname)

    const items = parseImport(raw)
    if (items && items.length > 0) setPending({ items, platform })
  }, [])

  return pending
}

export default function PlatformSyncPanel({
  pending,
  onClose,
  onImported,
}: {
  pending: { items: PlatformItem[]; platform: SyncPlatform } | null
  onClose: () => void
  onImported: () => void
}) {
  const [syncTab, setSyncTab] = useState<SyncPlatform>(pending?.platform ?? 'vinted')
  const [pendingItems, setPendingItems] = useState<PlatformItem[] | null>(pending?.items ?? null)
  const pendingPlatform: SyncPlatform = pending?.platform ?? syncTab
  const { importFromBrowser, loading: syncing, result: syncResult, error: syncError } = useSyncPlatform()

  const origin = window.location.origin

  const handleImport = async () => {
    if (!pendingItems) return
    await importFromBrowser(pendingItems, pendingPlatform)
    setPendingItems(null)
    onImported()
  }

  const handleClose = () => {
    setPendingItems(null)
    onClose()
  }

  const activePlatform = PLATFORM_CONFIG[syncTab]
  const bookmarkletHref = syncTab === 'vinted'
    ? generateVintedBookmarklet(origin)
    : generateWallapopBookmarklet(origin)
  const bookmarkletLabel = `Miss Outfits — ${activePlatform.label} ↗`

  return (
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
  )
}
