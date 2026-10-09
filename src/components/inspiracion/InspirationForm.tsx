import { useEffect, useState } from 'react'
import { Bookmark, ShoppingBag, Sparkles, Trash2 } from 'lucide-react'
import Modal from '@/components/shared/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useConfirm } from '@/components/shared/ConfirmModal'
import {
  useCreateInspiration,
  useUpdateInspiration,
  useDeleteInspiration,
  isPinterestUrl,
} from '@/hooks/useInspirations'
import { fetchUrlPreview, getErrorMessage } from '@/lib/utils'
import { cx } from '@/lib/utils'
import type { Inspiration, InspirationKind } from '@/types/database'

export default function InspirationForm({
  open,
  onClose,
  item,
  defaultKind = 'pinterest',
}: {
  open: boolean
  onClose: () => void
  item?: Inspiration | null
  defaultKind?: InspirationKind
}) {
  const { user } = useAuth()
  const create = useCreateInspiration()
  const update = useUpdateInspiration()
  const del = useDeleteInspiration()
  const confirm = useConfirm()

  const [kind, setKind] = useState<InspirationKind>(defaultKind)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (item) {
      setKind(item.kind)
      setUrl(item.url)
      setTitle(item.title ?? '')
      setImageUrl(item.image_url ?? '')
    } else {
      setKind(defaultKind)
      setUrl('')
      setTitle('')
      setImageUrl('')
    }
    setError(null)
  }, [open, item, defaultKind])

  // Auto-detectar Pinterest si la URL lo es
  useEffect(() => {
    if (item) return
    if (url && isPinterestUrl(url)) setKind('pinterest')
  }, [url, item])

  async function loadPreview() {
    if (!url) return
    setLoadingPreview(true); setError(null)
    const preview = await fetchUrlPreview(url)
    setLoadingPreview(false)
    if (!preview) { setError('No se pudo obtener la vista previa.'); return }
    if (preview.title && !title) setTitle(preview.title)
    if (preview.image && !imageUrl) setImageUrl(preview.image)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true); setError(null)
    try {
      const payload = {
        user_id: user.id,
        kind,
        url: url.trim(),
        title: title.trim() || null,
        image_url: imageUrl.trim() || null,
      }
      if (item) {
        await update.mutateAsync({ id: item.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    const ok = await confirm({
      title: 'Eliminar de inspiración',
      message: `Vas a borrar "${item.title ?? item.url}" de tu sección de ideas.`,
      confirmText: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    await del.mutateAsync(item.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Editar idea' : 'Añadir idea'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setKind('pinterest')}
              className={cx('btn', kind === 'pinterest' ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200' : 'btn-secondary')}>
              <Bookmark className="w-4 h-4" /> Pinterest
            </button>
            <button type="button" onClick={() => setKind('store')}
              className={cx('btn', kind === 'store' ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200' : 'btn-secondary')}>
              <ShoppingBag className="w-4 h-4" /> Tienda
            </button>
          </div>
        </div>

        <div>
          <label className="label">Enlace</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={kind === 'pinterest'
                ? 'https://www.pinterest.com/usuario/board/'
                : 'https://www.zara.com/es/es/woman-new-l1180.html'
              }
            />
            <button
              type="button"
              onClick={loadPreview}
              disabled={loadingPreview || !url}
              className="btn-secondary"
              title="Cargar título e imagen automáticamente"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
          {kind === 'store' && (
            <p className="text-xs text-muted mt-1.5">
              Tip: pega la URL de "novedades" o "new in" de la tienda para tener atajo directo.
            </p>
          )}
        </div>

        {imageUrl && (
          <div className="aspect-video rounded-2xl overflow-hidden bg-surface-soft max-h-48">
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'pinterest' ? 'Mi board de looks' : 'Zara — Novedades mujer'}
          />
        </div>

        <div>
          <label className="label">Imagen (URL)</label>
          <input
            className="input"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-2">
          {item && (
            <button type="button" onClick={handleDelete} className="btn-danger">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
