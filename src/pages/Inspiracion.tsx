import { useMemo, useState, useEffect } from 'react'
import { Plus, ExternalLink, Bookmark, ShoppingBag, ImageOff, Lightbulb, RefreshCw, X, ChevronLeft } from 'lucide-react'
import { useInspirations } from '@/hooks/useInspirations'
import { useSearchStore } from '@/store/search'
import InspirationForm from '@/components/inspiracion/InspirationForm'
import EmptyState from '@/components/shared/EmptyState'
import {
  usePinterestToken,
  usePinterestBoards,
  usePinterestPins,
  useDisconnectPinterest,
  buildPinterestOAuthUrl,
  type PinterestBoard,
  type PinterestPin,
} from '@/hooks/usePinterest'
import { safeHttpUrl } from '@/lib/utils'
import type { Inspiration, InspirationKind } from '@/types/database'

const PINTEREST_CLIENT_ID = import.meta.env.VITE_PINTEREST_CLIENT_ID ?? ''
// Pinterest aun no esta autorizado por su equipo de revision. Oculta la
// integracion nativa (conectar/tableros/pines) sin tocar los atajos manuales.
const PINTEREST_ENABLED = false

// ────────────────────────────────────────────────────────────────────────────
// Pinterest section
// ────────────────────────────────────────────────────────────────────────────

function PinterestPinCard({ pin }: { pin: PinterestPin }) {
  const imgUrl = pin.media?.images?.['600x']?.url ?? pin.media?.images?.['236x']?.url
  return (
    <a
      href={pin.link ?? `https://www.pinterest.com/pin/${pin.id}/`}
      target="_blank"
      rel="noreferrer"
      className="card overflow-hidden block hover:shadow-md transition group"
    >
      <div className="aspect-square bg-surface-soft">
        {imgUrl ? (
          <img src={imgUrl} alt={pin.title ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-8 h-8 text-muted/40" />
          </div>
        )}
      </div>
      {pin.title && (
        <div className="p-2">
          <p className="text-xs font-medium line-clamp-2 text-ink">{pin.title}</p>
        </div>
      )}
    </a>
  )
}

function BoardView({ board, token, onBack }: { board: PinterestBoard; token: string; onBack: () => void }) {
  const { data: pins = [], isLoading } = usePinterestPins(token, board.id)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="btn-secondary p-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="font-semibold text-ink text-sm">{board.name}</h3>
          <p className="text-xs text-muted">{board.pin_count} pines</p>
        </div>
      </div>
      {isLoading ? (
        <p className="text-center text-muted py-8 text-sm">Cargando pines...</p>
      ) : pins.length === 0 ? (
        <p className="text-center text-muted py-8 text-sm">Este tablero no tiene pines.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pins.map((pin) => <PinterestPinCard key={pin.id} pin={pin} />)}
        </div>
      )}
    </div>
  )
}

function PinterestSection({ token }: { token: string }) {
  const { data: boards = [], isLoading, refetch } = usePinterestBoards(token)
  const { mutate: disconnect } = useDisconnectPinterest()
  const [selectedBoard, setSelectedBoard] = useState<PinterestBoard | null>(null)

  if (selectedBoard) {
    return <BoardView board={selectedBoard} token={token} onBack={() => setSelectedBoard(null)} />
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="heading-md flex items-center gap-2">
          <PinterestIcon className="w-4 h-4 text-[#e60023]" /> Tu Pinterest
        </h2>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-surface-soft text-muted transition" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => disconnect()} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition" title="Desconectar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-muted py-8 text-sm">Cargando tableros...</p>
      ) : boards.length === 0 ? (
        <p className="text-sm text-muted bg-surface-soft rounded-xl p-4 text-center">No se encontraron tableros publicos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {boards.map((board) => {
            const cover = board.media?.image_cover_url ?? board.media?.pin_thumbnail_urls?.[0]
            return (
              <button
                key={board.id}
                onClick={() => setSelectedBoard(board)}
                className="card overflow-hidden text-left group hover:shadow-md transition"
              >
                <div className="aspect-square bg-surface-soft">
                  {cover ? (
                    <img src={cover} alt={board.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PinterestIcon className="w-10 h-10 text-muted/30" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{board.name}</p>
                  <p className="text-xs text-muted">{board.pin_count} pines</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function PinterestConnectCard() {
  if (!PINTEREST_CLIENT_ID) {
    return (
      <div className="card p-4 text-center space-y-2">
        <PinterestIcon className="w-8 h-8 text-[#e60023] mx-auto" />
        <p className="text-sm font-semibold text-ink">Conecta tu Pinterest</p>
        <p className="text-xs text-muted">
          Falta configurar <code className="bg-surface-soft px-1 rounded">VITE_PINTEREST_CLIENT_ID</code> en tu <code>.env</code>.
        </p>
      </div>
    )
  }

  function connect() {
    const redirectUri = `${window.location.origin}/pinterest-callback`
    window.location.href = buildPinterestOAuthUrl(PINTEREST_CLIENT_ID, redirectUri)
  }

  return (
    <div className="card p-5 flex flex-col items-center gap-3 text-center">
      <PinterestIcon className="w-10 h-10 text-[#e60023]" />
      <div>
        <p className="font-semibold text-ink text-sm">Conecta tu Pinterest</p>
        <p className="text-xs text-muted mt-1">Ve tus tableros y pines directamente dentro de la app.</p>
      </div>
      <button onClick={connect} className="btn-primary w-full justify-center">
        Conectar Pinterest
      </button>
    </div>
  )
}

// SVG logo de Pinterest (P simple)
function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export default function Inspiracion() {
  const { data: items = [], isLoading } = useInspirations()
  const { query } = useSearchStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Inspiration | null>(null)
  const [defaultKind, setDefaultKind] = useState<InspirationKind>('pinterest')

  const { data: pinterestToken, isLoading: tokenLoading } = usePinterestToken()

  // Toast "conectado" cuando viene del callback
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('pinterest') === 'connected') {
      setConnected(true)
      window.history.replaceState({}, '', '/inspiracion')
      setTimeout(() => setConnected(false), 3000)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      (i.title ?? '').toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
    )
  }, [items, query])

  const pinterest = filtered.filter((i) => i.kind === 'pinterest')
  const stores = filtered.filter((i) => i.kind === 'store')

  function openAdd(kind: InspirationKind) {
    setEditing(null)
    setDefaultKind(kind)
    setFormOpen(true)
  }

  return (
    <div className="px-4 pb-4 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="heading-xl">Ideas</h1>
          <p className="text-sm text-muted mt-0.5">
            {PINTEREST_ENABLED
              ? 'Tus tableros de Pinterest y atajos a tus tiendas favoritas.'
              : 'Atajos a tus boards y tiendas favoritas.'}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setDefaultKind('pinterest'); setFormOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Anadir
        </button>
      </div>

      {PINTEREST_ENABLED && connected && (
        <div className="p-3 rounded-xl text-sm text-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          Pinterest conectado correctamente
        </div>
      )}

      {/* Seccion Pinterest nativa — oculta hasta tener autorizacion de Pinterest */}
      {PINTEREST_ENABLED && !tokenLoading && (
        pinterestToken
          ? <PinterestSection token={pinterestToken} />
          : <PinterestConnectCard />
      )}

      {/* Separador si hay contenido manual */}
      {(items.length > 0 || isLoading) && (
        <>
          <div className="space-y-7">
            <Section
              title="Atajos a boards"
              icon={Bookmark}
              items={pinterest}
              onAdd={() => openAdd('pinterest')}
              onEdit={(item) => { setEditing(item); setFormOpen(true) }}
            />
            <Section
              title="Tiendas favoritas"
              icon={ShoppingBag}
              items={stores}
              onAdd={() => openAdd('store')}
              onEdit={(item) => { setEditing(item); setFormOpen(true) }}
            />
          </div>
        </>
      )}

      {!isLoading && items.length === 0 && (!PINTEREST_ENABLED || (!pinterestToken && !tokenLoading)) && (
        <EmptyState
          icon={Lightbulb}
          title="Sin ideas guardadas aun"
          subtitle={PINTEREST_ENABLED
            ? 'Conecta Pinterest para ver tus tableros, o anade atajos a tus tiendas favoritas.'
            : 'Anade atajos a boards de Pinterest o a tus tiendas favoritas.'}
          action={
            <button onClick={() => openAdd('store')} className="btn-secondary">
              <Plus className="w-4 h-4" /> Anadir tienda
            </button>
          }
        />
      )}

      <InspirationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        defaultKind={defaultKind}
      />
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  items,
  onAdd,
  onEdit,
}: {
  title: string
  icon: typeof Bookmark
  items: Inspiration[]
  onAdd: () => void
  onEdit: (item: Inspiration) => void
}) {
  if (items.length === 0) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="heading-md flex items-center gap-2">
          <Icon className="w-4 h-4 text-brand-700" /> {title}
        </h2>
        <button onClick={onAdd} className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Anadir
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.id} className="card overflow-hidden">
            <button onClick={() => onEdit(it)} className="block w-full text-left">
              <div className="aspect-square bg-surface-soft">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.title ?? ''} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-8 h-8 text-muted/50" />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm font-medium truncate">{it.title ?? 'Sin titulo'}</p>
                <p className="text-xs text-muted truncate">{hostnameOf(it.url)}</p>
              </div>
            </button>
            <a
              href={safeHttpUrl(it.url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-500/10 py-2 border-t border-line-soft"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
