import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, X, Star, Link as LinkIcon, Plus, Loader2, Camera, Sparkles, Undo2, Info } from 'lucide-react'
import { cx, getErrorMessage } from '@/lib/utils'
import { compressImage } from '@/lib/imageCompression'
import { usePrettify } from '@/hooks/usePrettify'

/**
 * Estado de cada imagen en el picker.
 *
 * `previous` guarda el estado ANTERIOR al retoque (Prettify) para poder
 * deshacer. Es opcional y solo se rellena cuando se aplica un retoque.
 * Aunque el tipo es recursivo, en la práctica lo mantenemos a un solo
 * nivel: si se aplica un segundo retoque, `previous` sigue apuntando al
 * original de verdad, no al retoque intermedio (ver `prettifyAt`).
 */
export type PickerImage =
  | { kind: 'existing'; id: string; url: string; path: string | null; previous?: PickerImage }
  | { kind: 'new-file'; tempId: string; file: File; preview: string; previous?: PickerImage }
  | { kind: 'new-url'; tempId: string; url: string; previous?: PickerImage }

export function previewOf(img: PickerImage): string {
  if (img.kind === 'existing') return img.url
  if (img.kind === 'new-file') return img.preview
  return img.url
}

function keyOf(img: PickerImage): string {
  return img.kind === 'existing' ? img.id : img.tempId
}

export default function MultiImagePicker({
  images,
  onChange,
}: {
  images: PickerImage[]
  onChange: (next: PickerImage[]) => void
}) {
  const [filesDragging, setFilesDragging] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [prettifyingIdx, setPrettifyingIdx] = useState<number | null>(null)
  // Drag-reorder interno entre miniaturas
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [prettifyMenuIdx, setPrettifyMenuIdx] = useState<number | null>(null)
  const [prettifyMenuPos, setPrettifyMenuPos] = useState<{ top: number; right: number } | null>(null)

  function openPrettifyMenu(idx: number, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPrettifyMenuIdx(idx)
    setPrettifyMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }
  function closePrettifyMenu() { setPrettifyMenuIdx(null); setPrettifyMenuPos(null) }
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const { prettify, progress: prettifyProgress } = usePrettify()

  async function addFiles(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      setError('Solo se permiten imagenes (jpg, png, webp...)')
      return
    }
    setProcessing(true)
    try {
      const items: PickerImage[] = []
      for (const original of list) {
        const compressed = await compressImage(original)
        const preview = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = reject
          r.readAsDataURL(compressed)
        })
        items.push({
          kind: 'new-file',
          tempId: crypto.randomUUID(),
          file: compressed,
          preview,
        })
      }
      onChange([...images, ...items])
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo procesar la imagen'))
    } finally {
      setProcessing(false)
    }
  }

  async function prettifyAt(index: number, style: 'studio' | 'cream' | 'transparent' = 'studio') {
    const img = images[index]
    if (!img) return
    setPrettifyingIdx(index)
    setError(null)
    try {
      const source = img.kind === 'new-file' ? img.file : previewOf(img)
      const result = await prettify(source, { style })
      const preview = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(result)
      })

      // Guardar el estado anterior para poder deshacer.
      // Si ya había un `previous` (retoques encadenados), lo conservamos
      // para que "deshacer" vuelva SIEMPRE al original de verdad, no al
      // retoque intermedio.
      const previous = img.previous ?? img

      const next = [...images]
      next[index] = {
        kind: 'new-file',
        tempId: crypto.randomUUID(),
        file: result,
        preview,
        previous,
      }
      onChange(next)
    } catch (e) {
      setError(getErrorMessage(e, 'Error al aplicar el retoque'))
    } finally {
      setPrettifyingIdx(null)
    }
  }

  /** Devuelve la foto al estado anterior al último retoque. */
  function undoPrettifyAt(index: number) {
    const img = images[index]
    if (!img?.previous) return
    const next = [...images]
    next[index] = img.previous
    onChange(next)
  }

  function addUrl() {
    if (!urlValue.trim()) return
    onChange([
      ...images,
      { kind: 'new-url', tempId: crypto.randomUUID(), url: urlValue.trim() },
    ])
    setUrlValue('')
    setUrlMode(false)
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index))
  }

  function setCover(index: number) {
    if (index === 0) return
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.unshift(item)
    onChange(next)
  }

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const next = [...images]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onChange(next)
  }

  // --------- Drop de archivos externos en el grid ---------
  function isFileDrag(e: React.DragEvent) {
    return e.dataTransfer.types?.includes('Files')
  }

  function handleGridDragOver(e: React.DragEvent) {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setFilesDragging(true)
  }

  function handleGridDragLeave(e: React.DragEvent) {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setFilesDragging(false)
  }

  function handleGridDrop(e: React.DragEvent) {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setFilesDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  // --------- Drag-reorder interno entre miniaturas ---------
  function handleTileDragStart(e: React.DragEvent, i: number) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/x-miss-outfits-reorder', String(i))
    setDraggingIdx(i)
  }

  function handleTileDragOver(e: React.DragEvent, i: number) {
    if (isFileDrag(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overIdx !== i) setOverIdx(i)
  }

  function handleTileDrop(e: React.DragEvent, i: number) {
    if (isFileDrag(e)) return
    e.preventDefault()
    if (draggingIdx !== null) reorder(draggingIdx, i)
    setDraggingIdx(null)
    setOverIdx(null)
  }

  function handleTileDragEnd() {
    setDraggingIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <p className="text-[11px] text-muted leading-relaxed flex items-start gap-1">
          <Info className="w-3 h-3 shrink-0 mt-[1px]" />
          La primera es la portada. Arrastra para reordenar o usa la estrella para cambiarla.
        </p>
      )}

      <div
        onDragEnter={handleGridDragOver}
        onDragOver={handleGridDragOver}
        onDragLeave={handleGridDragLeave}
        onDrop={handleGridDrop}
        className={cx(
          'grid grid-cols-3 gap-2 p-2 rounded-2xl transition border-2 border-dashed',
          filesDragging ? 'border-brand-600 bg-brand-soft' : 'border-transparent'
        )}
      >
        {images.map((img, i) => {
          const isDragging = draggingIdx === i
          const isOver = overIdx === i && draggingIdx !== null && draggingIdx !== i
          const isPrettifying = prettifyingIdx === i
          return (
            <div
              key={keyOf(img)}
              draggable={!isPrettifying}
              onDragStart={(e) => handleTileDragStart(e, i)}
              onDragOver={(e) => handleTileDragOver(e, i)}
              onDrop={(e) => handleTileDrop(e, i)}
              onDragEnd={handleTileDragEnd}
              className={cx(
                'relative aspect-square rounded-xl overflow-hidden bg-surface-soft group transition cursor-grab active:cursor-grabbing',
                isDragging && 'opacity-40 scale-95',
                isOver && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-page'
              )}
            >
              <img src={previewOf(img)} alt="" className="w-full h-full object-cover pointer-events-none" />

              {/* Overlay mientras se procesa el retoque */}
              {isPrettifying && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <span className="text-white text-[10px] font-semibold uppercase tracking-wide">
                    Retocando…
                  </span>
                  {prettifyProgress > 0 && prettifyProgress < 1 && (
                    <span className="text-white/80 text-[10px] tabular-nums">
                      {Math.round(prettifyProgress * 100)}%
                    </span>
                  )}
                </div>
              )}

              {/* Controles siempre visibles (mobile-first) */}
              {!isPrettifying && (
                <>
                  {/* Boton eliminar */}
                  <button type="button" onClick={() => removeAt(i)}
                    className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                    title="Quitar">
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Portada / marcar como portada */}
                  {i === 0 ? (
                    <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-brand-700 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-white" /> Portada
                    </div>
                  ) : (
                    <button type="button" onClick={() => setCover(i)}
                      className="absolute top-1 left-1 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                      title="Marcar como portada">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Botón deshacer retoque */}
                  {img.previous && (
                    <button
                      type="button"
                      onClick={() => undoPrettifyAt(i)}
                      disabled={prettifyingIdx !== null}
                      className="absolute bottom-1 left-1 flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-black/70 text-white hover:bg-black/85 transition shadow-lift"
                      title="Volver al original"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span className="text-[9px] font-semibold uppercase tracking-wide">Original</span>
                    </button>
                  )}

                  {/* Botón Prettify — abre portal para evitar overflow-hidden */}
                  <div className="absolute bottom-1 right-1">
                    <button
                      type="button"
                      onClick={(e) => prettifyMenuIdx === i ? closePrettifyMenu() : openPrettifyMenu(i, e)}
                      disabled={prettifyingIdx !== null}
                      className="p-1.5 rounded-full bg-brand-700/90 text-white hover:bg-brand-600 transition"
                      title="Retocar foto"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}

        {/* Tile para anadir */}
        <button
          type="button"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className={cx(
            'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition',
            processing
              ? 'border-brand-600 bg-brand-soft text-brand-700 cursor-wait'
              : filesDragging
                ? 'border-brand-600 bg-brand-soft text-brand-700'
                : 'border-line bg-surface-soft text-muted hover:bg-surface hover:border-muted/40'
          )}
        >
          {processing ? (
            <>
              <Loader2 className="w-6 h-6 mb-0.5 animate-spin" />
              <span className="text-[11px] font-medium">Comprimiendo...</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-6 h-6 mb-0.5" />
              <span className="text-[11px] font-medium leading-tight text-center px-1">
                {filesDragging ? '¡Suelta aquí!' : images.length === 0 ? 'Arrastra o pulsa' : 'Añadir'}
              </span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Anadir por URL */}
      {urlMode ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://..."
            className="input flex-1"
            autoFocus
          />
          <button type="button" onClick={addUrl} className="btn-primary">
            <Plus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setUrlMode(false); setUrlValue('') }} className="btn-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={processing}
            className="btn-secondary flex-1 justify-center text-sm"
          >
            <Camera className="w-4 h-4" /> Tomar foto
          </button>
          <button type="button" onClick={() => setUrlMode(true)}
            className="btn-ghost flex-1 justify-center text-sm">
            <LinkIcon className="w-4 h-4" /> Imagen por URL
          </button>
        </div>
      )}

      {error && <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Portal del menú Prettify — fuera de overflow-hidden */}
      {prettifyMenuIdx !== null && prettifyMenuPos && createPortal(
        <>
          {/* Backdrop transparente para cerrar al tocar fuera */}
          <div className="fixed inset-0 z-[998]" onClick={closePrettifyMenu} />
          <div
            style={{ position: 'fixed', top: prettifyMenuPos.top, right: prettifyMenuPos.right, zIndex: 999 }}
            className="flex flex-col gap-0.5 bg-surface border border-line rounded-xl p-1.5 shadow-lift whitespace-nowrap min-w-[148px]"
          >
            {([
              { style: 'studio' as const, label: 'Estudio (blanco)', dot: { background: '#fff', border: '1px solid #ccc' } },
              { style: 'cream' as const, label: 'Crema (cálido)', dot: { background: '#F8F3EE', border: '1px solid #E7DCD3' } },
              { style: 'transparent' as const, label: 'Solo recorte (PNG)', dot: { background: 'repeating-linear-gradient(45deg,#ddd 0 3px,#f5f5f5 3px 6px)', border: '1px solid #ccc' } },
            ]).map(({ style, label, dot }) => (
              <button
                key={style}
                type="button"
                onClick={() => { closePrettifyMenu(); prettifyAt(prettifyMenuIdx, style) }}
                disabled={prettifyingIdx !== null}
                className="text-left text-[12px] px-2.5 py-2 rounded-lg hover:bg-surface-soft active:bg-surface-soft text-ink flex items-center gap-2"
              >
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={dot} />
                {label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
