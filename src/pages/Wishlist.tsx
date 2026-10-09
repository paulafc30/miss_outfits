import { useEffect, useMemo, useState } from 'react'
import { Plus, ExternalLink, ImageOff, Heart, FolderCog } from 'lucide-react'
import { useWishlist } from '@/hooks/useWishlist'
import { useWishlistFolders } from '@/hooks/useWishlistFolders'
import { useSearchStore } from '@/store/search'
import WishlistForm, { WishlistPrefill } from '@/components/wishlist/WishlistForm'
import WishlistFoldersManager from '@/components/wishlist/WishlistFoldersManager'
import EmptyState from '@/components/shared/EmptyState'
import { cx, formatPrice, safeHttpUrl } from '@/lib/utils'
import { consumeSharedPayload } from '@/lib/sharedItem'
import type { WishlistItem } from '@/types/database'

export default function Wishlist() {
  // null = "Todas" (sin filtro), id = lista concreta
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const { data: items = [], isLoading } = useWishlist(activeFolder)
  const { data: folders = [] } = useWishlistFolders()
  const { query } = useSearchStore()
  const [formOpen, setFormOpen] = useState(false)
  const [foldersOpen, setFoldersOpen] = useState(false)
  const [editing, setEditing] = useState<WishlistItem | null>(null)
  const [prefill, setPrefill] = useState<WishlistPrefill | undefined>(undefined)

  // Consumir share apuntado a wishlist y abrir el formulario con auto-preview
  useEffect(() => {
    const shared = consumeSharedPayload('wishlist')
    if (shared) {
      setPrefill({
        url: shared.url || undefined,
        name: shared.title || undefined,
        autoFetchPreview: !!shared.url,
        wishlist_id: activeFolder ?? undefined,
      })
      setEditing(null)
      setFormOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      (i.name ?? '').toLowerCase().includes(q) ||
      (i.notes ?? '').toLowerCase().includes(q) ||
      i.url.toLowerCase().includes(q)
    )
  }, [items, query])

  function openNewItem() {
    setEditing(null)
    setPrefill(activeFolder ? { wishlist_id: activeFolder } : undefined)
    setFormOpen(true)
  }

  const activeFolderName =
    activeFolder ? folders.find((f) => f.id === activeFolder)?.name ?? 'Lista' : 'Todas'

  return (
    <div className="px-4 pb-4 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="heading-xl">Deseos</h1>
          <p className="text-sm text-muted mt-0.5">
            {items.length} {items.length === 1 ? 'item' : 'items'} en {activeFolderName.toLowerCase()}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFoldersOpen(true)} className="btn-secondary" title="Gestionar listas">
            <FolderCog className="w-4 h-4" />
          </button>
          <button onClick={openNewItem} className="btn-primary">
            <Plus className="w-4 h-4" /> Añadir
          </button>
        </div>
      </div>

      {/* Filtro de listas */}
      {folders.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          <button onClick={() => setActiveFolder(null)}
            className={cx(
              'chip whitespace-nowrap font-medium border-2 transition shrink-0',
              activeFolder === null
                ? 'bg-brand-gradient text-white border-transparent shadow-soft'
                : 'bg-surface border-line-soft text-muted hover:text-ink'
            )}>
            Todas
          </button>
          {folders.map((f) => {
            const isActive = activeFolder === f.id
            return (
              <button key={f.id} onClick={() => setActiveFolder(isActive ? null : f.id)}
                className={cx(
                  'chip whitespace-nowrap font-medium gap-1.5 transition shrink-0 border-2',
                  isActive ? 'bg-surface text-ink shadow-soft' : 'bg-surface border-line-soft text-muted hover:text-ink'
                )}
                style={isActive ? { borderColor: f.color } : undefined}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                {f.name}
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-muted py-12">Cargando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={
            activeFolder
              ? `"${activeFolderName}" está vacía`
              : 'Tu lista de deseos está vacía'
          }
          subtitle="Pega un enlace de Zara, Vinted o donde quieras y guárdalo para más tarde."
          action={
            <button onClick={openNewItem} className="btn-primary">
              <Plus className="w-4 h-4" /> Añadir
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((it) => (
            <div key={it.id} className="card overflow-hidden">
              <button onClick={() => { setEditing(it); setFormOpen(true) }} className="block w-full text-left">
                <div className="aspect-square bg-surface-soft">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-8 h-8 text-muted/50" /></div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{it.name ?? 'Sin nombre'}</p>
                  <p className="text-xs text-muted">{formatPrice(it.price)}</p>
                </div>
              </button>
              <a href={safeHttpUrl(it.url) ?? undefined} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-xs text-brand-700 hover:bg-brand-50 py-2 border-t border-line-soft">
                <ExternalLink className="w-3.5 h-3.5" /> Ver
              </a>
            </div>
          ))}
        </div>
      )}

      <WishlistForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setPrefill(undefined) }}
        item={editing}
        prefill={editing ? undefined : prefill}
      />
      <WishlistFoldersManager open={foldersOpen} onClose={() => setFoldersOpen(false)} />
    </div>
  )
}
