/**
 * Genera un collage cuadrado (1080×1080) con las prendas de un outfit
 * usando canvas en cliente. Devuelve un Blob PNG listo para compartir
 * vía Web Share API o para descargar.
 */

interface CollageOptions {
  /** Tamaño en píxeles del lado del canvas. Por defecto 1080 (square Instagram). */
  size?: number
  /** Color de fondo en hex. Por defecto un crema rosa muy suave. */
  bg?: string
  /** Color del título. */
  titleColor?: string
  /** Padding interno en píxeles. */
  padding?: number
}

/** Dado N prendas, decide el grid (cols × rows) más equilibrado. */
function gridDimensions(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 }
  if (n === 2) return { cols: 2, rows: 1 }
  if (n === 3) return { cols: 3, rows: 1 }
  if (n === 4) return { cols: 2, rows: 2 }
  if (n <= 6) return { cols: 3, rows: 2 }
  return { cols: 3, rows: 3 } // cap a 9
}

/** Carga una imagen con CORS anónimo; resuelve null si falla. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Pinta `img` dentro de la celda x,y,w,h con object-fit:cover y esquinas redondeadas. */
function drawCoverRounded(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.save()
  // Recorte con bordes redondeados (fallback a rect plano si no hay roundRect)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
  } else {
    ctx.rect(x, y, w, h)
  }
  ctx.clip()

  // Placeholder gris-claro si la imagen no cargó
  ctx.fillStyle = '#F5F0F3'
  ctx.fillRect(x, y, w, h)

  if (img) {
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const scale = Math.max(w / iw, h / ih)
    const sw = w / scale
    const sh = h / scale
    const sx = (iw - sw) / 2
    const sy = (ih - sh) / 2
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  }
  ctx.restore()
}

/**
 * Genera el collage. Devuelve un Blob PNG.
 *
 * @param outfitName Nombre del outfit (se dibuja en la parte superior).
 * @param imageUrls  URLs de las imágenes de las prendas (en orden de visualización).
 * @param opts       Opciones visuales.
 */
export async function generateOutfitCollage(
  outfitName: string,
  imageUrls: string[],
  opts: CollageOptions = {}
): Promise<Blob> {
  const size  = opts.size  ?? 1080
  const bg    = opts.bg    ?? '#FFF7F8'
  const titleColor = opts.titleColor ?? '#0F172A'
  const padding    = opts.padding    ?? 24

  // Cap a 9 imágenes para que el grid no se desborde
  const urls = imageUrls.slice(0, 9)
  const { cols, rows } = gridDimensions(urls.length)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no soportado')

  // Fondo
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // Título arriba
  const titleHeight = 96
  ctx.fillStyle = titleColor
  ctx.font = 'bold 44px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(outfitName || 'Outfit', size / 2, titleHeight / 2 + 12)

  // Grid debajo del título
  const gridTop = titleHeight + padding
  const gridBottom = size - padding
  const cellGap = 14
  const gridWidth  = size - padding * 2
  const gridHeight = gridBottom - gridTop
  const cellW = (gridWidth - cellGap * (cols - 1)) / cols
  const cellH = (gridHeight - cellGap * (rows - 1)) / rows

  // Cargar todas las imágenes en paralelo
  const imgs = await Promise.all(urls.map(loadImage))

  for (let i = 0; i < urls.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = padding + col * (cellW + cellGap)
    const y = gridTop + row * (cellH + cellGap)
    drawCoverRounded(ctx, imgs[i], x, y, cellW, cellH, 28)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen'))),
      'image/png',
      0.95
    )
  })
}

/**
 * Intenta compartir el blob usando la Web Share API. Si no está disponible
 * o falla, descarga el archivo como fallback.
 *
 * Devuelve 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string,
  options?: { title?: string; text?: string }
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: options?.title, text: options?.text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Si la share API falla por otra razón, caemos a descarga
    }
  }

  // Fallback: descarga
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return 'downloaded'
}
