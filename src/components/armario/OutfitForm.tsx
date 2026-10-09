import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/shared/Modal'
import MultiImagePicker, { PickerImage } from '@/components/shared/MultiImagePicker'
import ShareOutfitModal from './ShareOutfitModal'
import CompleteTheLook from './CompleteTheLook'
import { useClothes } from '@/hooks/useClothes'
import { useCategories } from '@/hooks/useCategories'
import { useCreateOutfit, useDeleteOutfit, useUpdateOutfit, useOutfits, OutfitWithItems } from '@/hooks/useOutfits'
import { useAuth } from '@/hooks/useAuth'
import { useConfirm } from '@/components/shared/ConfirmModal'
import { uploadImage, deleteImage } from '@/lib/images'
import { supabase } from '@/lib/supabase'
import { categoryTypeMap, suggestCompleteLook } from '@/lib/completeLook'
import type { OutfitImage } from '@/types/database'
import { Trash2, Check, Share2 } from 'lucide-react'
import { cx, getErrorMessage } from '@/lib/utils'

export default function OutfitForm({ open, onClose, outfit }: { open: boolean; onClose: () => void; outfit?: OutfitWithItems | null }) {
  const { user } = useAuth()
  const { data: closet = [] } = useClothes(['closet'])
  const { data: outfits = [] } = useOutfits()
  const { data: categories = [] } = useCategories()
  const create = useCreateOutfit()
  const update = useUpdateOutfit()
  const del = useDeleteOutfit()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [photos, setPhotos] = useState<PickerImage[]>([])
  const [originalPhotos, setOriginalPhotos] = useState<OutfitImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(outfit?.name ?? `Look #${outfits.length + 1}`)
    setSelected(new Set(outfit?.clothe_ids ?? []))
    if (outfit) {
      supabase
        .from('outfit_images')
        .select('*')
        .eq('outfit_id', outfit.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          const list = (data ?? []) as OutfitImage[]
          setOriginalPhotos(list)
          setPhotos(list.map((it) => ({ kind: 'existing', id: it.id, url: it.url, path: it.path })))
        })
    } else {
      setPhotos([])
      setOriginalPhotos([])
    }
  }, [open, outfit])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const typeById = useMemo(() => categoryTypeMap(categories), [categories])
  const completeLookSuggestions = useMemo(() => {
    if (selected.size === 0) return []
    const referenceClothes = closet.filter((c) => selected.has(c.id))
    return suggestCompleteLook(referenceClothes, closet, typeById, selected, 8)
  }, [selected, closet, typeById])

  async function syncOutfitImages(outfitId: string, userId: string) {
    const stillThere = new Set(
      photos.filter((p) => p.kind === 'existing').map((p) => p.kind === 'existing' ? p.id : '')
    )
    const toDelete = originalPhotos.filter((o) => !stillThere.has(o.id))
    for (const orig of toDelete) {
      if (orig.path) await deleteImage(orig.path)
      await supabase.from('outfit_images').delete().eq('id', orig.id)
    }
    for (let i = 0; i < photos.length; i++) {
      const item = photos[i]
      if (item.kind === 'existing') {
        const orig = originalPhotos.find((o) => o.id === item.id)
        if (orig && orig.position !== i) {
          await supabase.from('outfit_images').update({ position: i }).eq('id', item.id)
        }
      } else if (item.kind === 'new-file') {
        const up = await uploadImage(item.file, userId)
        await supabase.from('outfit_images').insert({
          outfit_id: outfitId, user_id: userId, url: up.url, path: up.path, position: i,
        })
      } else if (item.kind === 'new-url') {
        await supabase.from('outfit_images').insert({
          outfit_id: outfitId, user_id: userId, url: item.url, path: null, position: i,
        })
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true); setError(null)
    try {
      let outfitId: string
      if (outfit) {
        await update.mutateAsync({ id: outfit.id, name, clothe_ids: [...selected] })
        outfitId = outfit.id
      } else {
        const created = await create.mutateAsync({ user_id: user.id, name, clothe_ids: [...selected] })
        outfitId = created.id
      }
      await syncOutfitImages(outfitId, user.id)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!outfit) return
    const ok = await confirm({
      title: 'Eliminar outfit',
      message: `Vas a borrar el outfit "${outfit.name}" y todas sus fotos. Las prendas vinculadas NO se eliminan.`,
      confirmText: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    await del.mutateAsync(outfit.id)
    onClose()
  }

  const canShare = (selected.size > 0 || photos.length > 0) && name.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} title={outfit ? 'Editar outfit' : 'Nuevo outfit'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Look domingo" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label mb-0">Fotos del outfit</span>
            <span className="text-xs text-muted">Opcional</span>
          </div>
          <MultiImagePicker images={photos} onChange={setPhotos} />
          <p className="text-xs text-muted mt-1.5">
            Por ejemplo, una foto tuya con el look puesto, o varias del conjunto montado.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label mb-0">Prendas del armario</span>
            <button
              type="button"
              disabled={!canShare}
              onClick={() => setShareOpen(true)}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              title={canShare ? 'Generar imagen del outfit' : 'Anade fotos o prendas y dale nombre'}
            >
              <Share2 className="w-3.5 h-3.5" /> Compartir como imagen
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {closet.map((c) => {
              const isSelected = selected.has(c.id)
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.id)}
                  className={cx('relative aspect-square rounded-xl overflow-hidden border-2 transition',
                    isSelected ? 'border-brand-600' : 'border-transparent')}
                >
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full bg-surface-soft" />}
                  {isSelected && (
                    <div className="absolute inset-0 bg-brand-700/30 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {closet.length === 0 && <p className="text-sm text-muted">No hay prendas en tu armario aun.</p>}
        </div>

        <CompleteTheLook suggestions={completeLookSuggestions} onSelect={toggle} />

        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-2">
          {outfit && <button type="button" onClick={handleDelete} className="btn-danger"><Trash2 className="w-4 h-4" /></button>}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </form>

      <ShareOutfitModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        outfitName={name}
        clotheIds={[...selected]}
        photoUrls={photos.map((p) => p.kind === 'existing' ? p.url : p.kind === 'new-file' ? p.preview : p.url)}
      />
    </Modal>
  )
}
