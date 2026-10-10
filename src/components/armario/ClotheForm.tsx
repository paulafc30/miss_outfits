import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/shared/Modal'
import MultiImagePicker, { PickerImage, previewOf } from '@/components/shared/MultiImagePicker'
import ColorPicker, { type ColorSelection } from '@/components/shared/ColorPicker'
import { colorHexByName } from '@/lib/colorPalette'
import Combobox from '@/components/shared/Combobox'
import DescriptionModal from '@/components/venta/DescriptionModal'
import { useCategories } from '@/hooks/useCategories'
import { useSeasons, useClotheSeasonIds, useSetClotheSeasons } from '@/hooks/useSeasons'
import { useBrands } from '@/hooks/useBrands'
import { useCreateClothe, useDeleteClothe, useUpdateClothe } from '@/hooks/useClothes'
import { uploadImage, deleteImage } from '@/lib/images'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { SIZE_OPTIONS, MATERIAL_OPTIONS } from '@/lib/options'
import { fetchUrlPreview, cx, getErrorMessage } from '@/lib/utils'
import { isImageUrl } from '@/lib/sharedItem'
import { useConfirm } from '@/components/shared/ConfirmModal'
import { extractDominantColorName } from '@/lib/colorExtraction'
import type { Clothe, ClothesStatus, ClotheImage } from '@/types/database'
import { Loader2, Trash2, Wand2, X } from 'lucide-react'

export interface ClothePrefill {
  name?: string
  url?: string        // si parece imagen, se usa como primera foto
  notes?: string
  price?: number
  /** Si viene desde share de Wallapop/Vinted, activamos su toggle al crear. */
  platform?: 'wallapop' | 'vinted'
  /** Status forzado al crear (e.g. 'en_venta' cuando viene de Wallapop). */
  forceStatus?: ClothesStatus
}

export default function ClotheForm({
  open,
  onClose,
  clothe,
  defaultStatus = 'closet',
  prefill,
}: {
  open: boolean
  onClose: () => void
  clothe?: Clothe | null
  defaultStatus?: ClothesStatus
  prefill?: ClothePrefill
}) {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const { data: seasons = [] } = useSeasons()
  const { data: existingSeasonIds = [] } = useClotheSeasonIds(clothe?.id)
  const setClotheSeasonsM = useSetClotheSeasons()
  const { data: brandSuggestions = [] } = useBrands()
  const createMut = useCreateClothe()
  const updateMut = useUpdateClothe()
  const deleteMut = useDeleteClothe()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [selectedSeasonIds, setSelectedSeasonIds] = useState<string[]>([])
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [colorSelections, setColorSelections] = useState<ColorSelection[]>([])
  const colorNames = colorSelections.map((c) => c.name)
  const colorHexes = colorSelections.map((c) => c.hex)
  const [material, setMaterial] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState<string>('')
  const [images, setImages] = useState<PickerImage[]>([])
  const [originalImages, setOriginalImages] = useState<ClotheImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [descOpen, setDescOpen] = useState(false)
  const [fetchingPreview, setFetchingPreview] = useState(false)
  const [suggestedColor, setSuggestedColor] = useState<string | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  useEffect(() => {
    if (!open) return
    if (clothe) {
      setName(clothe.name)
      setCategoryId(clothe.category_id ?? '')
      setSelectedSeasonIds(existingSeasonIds)
      setBrand(clothe.brand ?? '')
      setSize(clothe.size ?? '')
      {
        const names = clothe.colors ?? (clothe.color ? [clothe.color] : [])
        const hexes = clothe.color_hexes ?? []
        setColorSelections(names.map((n, i) => ({ name: n, hex: hexes[i] ?? colorHexByName(n) ?? '#999999' })))
      }
      setMaterial(clothe.material ?? '')
      setTags(clothe.tags.join(', '))
      setNotes(clothe.notes ?? '')
      setPrice(clothe.price ? String(clothe.price) : '')
      supabase
        .from('clothe_images')
        .select('*')
        .eq('clothe_id', clothe.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          const list = (data ?? []) as ClotheImage[]
          setOriginalImages(list)
          setImages(list.map((it) => ({ kind: 'existing', id: it.id, url: it.url, path: it.path })))
        })
    } else {
      setName(prefill?.name ?? '')
      setCategoryId(''); setSelectedSeasonIds([]); setBrand(''); setSize(''); setColorSelections([]); setMaterial('')
      setTags('')
      setNotes(prefill?.notes ?? '')
      setPrice(prefill?.price != null ? String(prefill.price) : '')
      setOriginalImages([])
      const sharedUrl = prefill?.url ?? ''
      if (sharedUrl && isImageUrl(sharedUrl)) {
        // URL directa a una imagen — la usamos como primera foto
        setImages([{ kind: 'new-url', tempId: crypto.randomUUID(), url: sharedUrl }])
      } else if (sharedUrl) {
        // URL de página de producto: pedimos los metadatos vía microlink
        setImages([])
        setFetchingPreview(true)
        fetchUrlPreview(sharedUrl)
          .then((preview) => {
            if (!preview) return
            if (preview.image) {
              setImages([{ kind: 'new-url', tempId: crypto.randomUUID(), url: preview.image }])
            }
            // No pisamos lo que ya venía en prefill
            if (preview.title && !prefill?.name) setName(preview.title)
            if (preview.description && !prefill?.notes) setNotes(preview.description)
            if (preview.price != null && prefill?.price == null) setPrice(String(preview.price))
          })
          .finally(() => setFetchingPreview(false))
      } else {
        setImages([])
      }
    }
    setError(null)
    setSuggestedColor(null)
    setSuggestionDismissed(false)
  }, [open, clothe, prefill])

  // Detectar color dominante de la primera imagen (la portada) y sugerirlo
  // si la usuaria aún no ha elegido ningún color manualmente.
  useEffect(() => {
    if (!open) return
    if (colorSelections.length > 0) { setSuggestedColor(null); return }
    if (images.length === 0) { setSuggestedColor(null); return }
    const first = images[0]
    const src = previewOf(first)
    if (!src) return
    let cancelled = false
    extractDominantColorName(src).then((name) => {
      if (!cancelled) setSuggestedColor(name)
    })
    return () => { cancelled = true }
  }, [open, images, colorSelections])

  /** Construye una prenda "virtual" con los valores actuales del formulario,
   *  para que el modal de descripción pueda generarse sin guardar todavía. */
  const virtualClothe = useMemo<Clothe>(() => ({
    id: clothe?.id ?? 'preview',
    user_id: user?.id ?? '',
    name: name.trim() || 'Sin nombre',
    category_id: categoryId || null,
    image_url: null,
    image_path: null,
    notes: notes.trim() || null,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    status: clothe?.status ?? defaultStatus,
    on_wallapop: clothe?.on_wallapop ?? false,
    on_vinted: clothe?.on_vinted ?? false,
    price: price ? Number(price) : null,
    sold_at: clothe?.sold_at ?? null,
    brand: brand.trim() || null,
    size: size.trim() || null,
    color: colorNames[0] ?? null,
    colors: colorNames,
    color_hexes: colorHexes,
    material: material.trim() || null,
    created_at: clothe?.created_at ?? new Date().toISOString(),
    updated_at: clothe?.updated_at ?? new Date().toISOString(),
    listed_at: clothe?.listed_at ?? null,
  }), [clothe, user, name, categoryId, brand, size, colorSelections, material, tags, notes, price, defaultStatus])

  async function syncImages(clotheId: string, userId: string) {
    const stillThere = new Set(
      images.filter((i) => i.kind === 'existing').map((i) => i.kind === 'existing' ? i.id : '')
    )
    const toDelete = originalImages.filter((o) => !stillThere.has(o.id))
    for (const orig of toDelete) {
      if (orig.path) await deleteImage(orig.path)
      await supabase.from('clothe_images').delete().eq('id', orig.id)
    }

    for (let i = 0; i < images.length; i++) {
      const item = images[i]
      if (item.kind === 'existing') {
        const orig = originalImages.find((o) => o.id === item.id)
        if (orig && orig.position !== i) {
          await supabase.from('clothe_images').update({ position: i }).eq('id', item.id)
        }
      } else if (item.kind === 'new-file') {
        const up = await uploadImage(item.file, userId)
        await supabase.from('clothe_images').insert({
          clothe_id: clotheId, user_id: userId, url: up.url, path: up.path, position: i,
        })
      } else if (item.kind === 'new-url') {
        await supabase.from('clothe_images').insert({
          clothe_id: clotheId, user_id: userId, url: item.url, path: null, position: i,
        })
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true); setError(null)
    try {
      const payload: Partial<Clothe> & { name: string } = {
        name: name.trim(),
        category_id: categoryId || null,
        brand: brand.trim() || null,
        size: size.trim() || null,
        color: colorNames[0] ?? null,  // se mantiene por backward compat con esquema antiguo
        colors: colorNames,
        color_hexes: colorHexes,
        material: material.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes: notes.trim() || null,
        price: price ? Number(price) : null,
      }

      // Al crear desde share de Wallapop/Vinted, activar el toggle correspondiente
      if (!clothe && prefill?.platform === 'wallapop') payload.on_wallapop = true
      if (!clothe && prefill?.platform === 'vinted') payload.on_vinted = true

      let clotheId: string
      if (clothe) {
        await updateMut.mutateAsync({ id: clothe.id, ...payload })
        clotheId = clothe.id
      } else {
        const created = await createMut.mutateAsync({
          user_id: user.id,
          status: prefill?.forceStatus ?? defaultStatus,
          ...payload,
        })
        clotheId = created.id
      }

      await syncImages(clotheId, user.id)
      await setClotheSeasonsM.mutateAsync({ clotheId, seasonIds: selectedSeasonIds })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!clothe) return
    const ok = await confirm({
      title: 'Eliminar prenda',
      message: `Vas a borrar "${clothe.name}" y todas sus fotos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    await deleteMut.mutateAsync(clothe)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={clothe ? 'Editar prenda' : 'Nueva prenda'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {prefill?.platform && !clothe && (
          <div className="px-3 py-2 rounded-xl bg-brand-soft text-brand-700 dark:text-brand-200 text-xs">
            <strong>Datos extraídos de {prefill.platform === 'wallapop' ? 'Wallapop' : 'Vinted'}.</strong>{' '}
            Revisa el precio y rellena talla, color y composición si faltan.
          </div>
        )}
        {fetchingPreview && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-soft text-brand-700 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Obteniendo datos del enlace…
          </div>
        )}
        <MultiImagePicker images={images} onChange={setImages} />
        <p className="text-[11px] text-muted leading-relaxed -mt-1">
          📸 Mejor resultado con el boton de mejora de imagen: fondo blanco o liso, buena luz natural, prenda extendida o en percha y encuadre centrado.
        </p>

        <div>
          <label className="label">Nombre</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Camisa blanca" />
        </div>

        <div>
          <label className="label">Categoría</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Sin categoría —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Temporada <span className="text-muted font-normal text-xs">(puedes seleccionar varias)</span></label>
          <div className="flex flex-wrap gap-2 mt-1">
            {seasons.map((s) => {
              const active = selectedSeasonIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSeasonIds(
                    active
                      ? selectedSeasonIds.filter((id) => id !== s.id)
                      : [...selectedSeasonIds, s.id]
                  )}
                  className={cx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition',
                    active
                      ? 'border-transparent text-white'
                      : 'border-line bg-surface text-muted hover:text-ink hover:border-muted/40'
                  )}
                  style={active ? { backgroundColor: s.color } : undefined}
                >
                  <span>{s.icon}</span>
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Marca</label>
            <Combobox value={brand} onChange={setBrand} suggestions={brandSuggestions} placeholder="Zara" />
          </div>
          <div>
            <label className="label">Talla</label>
            <Combobox value={size} onChange={setSize} suggestions={SIZE_OPTIONS} placeholder="M / 38" />
          </div>
        </div>

        <div>
          <label className="label">Material</label>
          <Combobox value={material} onChange={setMaterial} suggestions={MATERIAL_OPTIONS} placeholder="Algodón" />
        </div>

        <div>
          <label className="label">Colores</label>
          <ColorPicker
            value={colorSelections}
            onChange={setColorSelections}
            max={3}
            imageUrl={images.length > 0 ? previewOf(images[0]) : null}
          />
          {suggestedColor && colorSelections.length === 0 && !suggestionDismissed && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-soft text-brand-700 dark:text-brand-200 text-xs animate-fade-in">
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">
                Tu foto parece{' '}
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full align-middle mx-0.5 border border-line"
                  style={{
                    background:
                      colorHexByName(suggestedColor) === 'multicolor'
                        ? 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
                        : colorHexByName(suggestedColor) ?? '#999',
                  }}
                />
                <strong className="ml-0.5">{suggestedColor}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setColorSelections([{ name: suggestedColor, hex: colorHexByName(suggestedColor) ?? '#999999' }])
                  setSuggestionDismissed(true)
                }}
                className="font-semibold underline shrink-0"
              >
                Usar
              </button>
              <button
                type="button"
                onClick={() => setSuggestionDismissed(true)}
                className="p-0.5 rounded hover:bg-brand-100 dark:hover:bg-brand-500/10 shrink-0"
                aria-label="Cerrar sugerencia"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="label">Etiquetas (separadas por coma)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="verano, casual" />
        </div>

        <div>
          <label className="label">Precio (opcional)</label>
          <input className="input" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="20.00" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="label mb-0">Notas</span>
            <button
              type="button"
              onClick={() => setDescOpen(true)}
              disabled={!name.trim()}
              className="btn-ghost text-xs py-0.5 px-2 gap-1"
              title="Generar descripcion con IA"
            >
              <Wand2 className="w-3 h-3" /> Generar con IA
            </button>
          </div>
          <textarea
            className="input resize-none"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas sobre la prenda..."
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          {clothe && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button type="submit" disabled={submitting || !name.trim()} className="btn-primary flex-1 justify-center">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : clothe ? 'Guardar cambios' : 'Añadir prenda'}
          </button>
        </div>
      </form>

      <DescriptionModal
        open={descOpen}
        onClose={() => setDescOpen(false)}
        clothe={virtualClothe}
        mode="product"
      />
    </Modal>
  )
}
