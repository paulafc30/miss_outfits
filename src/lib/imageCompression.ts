import { decodeImage, readExifOrientation } from './imageOrientation'

/**
 * Comprime una imagen en el navegador antes de subirla:
 * - Redimensiona si el lado más largo supera `maxSize` (por defecto 1280 px).
 * - Re-encoda como JPEG con calidad `quality` (por defecto 0.8).
 * - Si la imagen ya pesa poco o el resultado no mejora, devuelve el original.
 * - Si por cualquier razón la compresión falla, devuelve el original (fallback seguro).
 */
export async function compressImage(
  file: File,
  opts: { maxSize?: number; quality?: number } = {}
): Promise<File> {
  const maxSize = opts.maxSize ?? 1280
  const quality = opts.quality ?? 0.8

  // Si la foto trae una orientación EXIF distinta de la normal (típico al hacerla con la
  // cámara en vertical), hay que re-dibujarla para "hornear" el giro en los píxeles.
  const needsRotation = (await readExifOrientation(file)) !== 1

  // No comprimir si ya es pequeña (< 400 KB) salvo formatos pesados
  if (!needsRotation && file.size < 400 * 1024 && /jpeg|jpg|webp/i.test(file.type)) return file

  try {
    const bitmap = await loadBitmap(file)
    const { width, height } = fitInside(bitmap.width, bitmap.height, maxSize)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    if ('close' in bitmap) bitmap.close()

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob) return file

    // Si por la razón que sea el comprimido pesa más que el original, no lo usamos
    if (!needsRotation && blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

function fitInside(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h }
  if (w > h) return { width: max, height: Math.round((h * max) / w) }
  return { width: Math.round((w * max) / h), height: max }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  return decodeImage(file)
}
