/**
 * Utilidades de orientación de fotos.
 *
 * - readExifOrientation: lee la etiqueta EXIF de orientación de un JPEG (1 = normal).
 *   Los móviles guardan la foto "tumbada" y marcan en EXIF cómo girarla; si esa marca se
 *   pierde o la ignora algún visor, la prenda se ve de lado.
 * - rotateImage: gira una imagen 90° (horario o antihorario) y devuelve un File nuevo.
 */

/** Devuelve la orientación EXIF (1-8) de un JPEG, o 1 si no hay o no es JPEG. */
export async function readExifOrientation(file: File): Promise<number> {
  if (!/jpe?g/i.test(file.type)) return 1
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer()
    const v = new DataView(buf)
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1
    let off = 2
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off)
      off += 2
      if (marker === 0xffe1) {
        if (off + 2 + 6 > v.byteLength) return 1
        // "Exif\0\0"
        if (v.getUint32(off + 2) !== 0x45786966) return 1
        const tiff = off + 8
        const little = v.getUint16(tiff) === 0x4949
        const ifd = tiff + v.getUint32(tiff + 4, little)
        if (ifd + 2 > v.byteLength) return 1
        const entries = v.getUint16(ifd, little)
        for (let i = 0; i < entries; i++) {
          const e = ifd + 2 + i * 12
          if (e + 12 > v.byteLength) return 1
          if (v.getUint16(e, little) === 0x0112) {
            const o = v.getUint16(e + 8, little)
            return o >= 1 && o <= 8 ? o : 1
          }
        }
        return 1
      }
      if ((marker & 0xff00) !== 0xff00) return 1
      off += v.getUint16(off)
    }
  } catch {
    // ignorar: tratamos la foto como normal
  }
  return 1
}

/**
 * Decodifica una imagen aplicando su orientación EXIF, con respaldo para navegadores que no
 * aceptan opciones en createImageBitmap (Safari antiguo, Firefox en algunos casos): entonces se
 * usa un <img>, que todos los navegadores modernos orientan solos.
 */
export async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      // continúa al respaldo
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = url
    })
  } finally {
    // el <img> ya está cargado: se puede liberar la URL
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Gira la imagen 90° (clockwise=true: horario) y devuelve un File nuevo. */
export async function rotateImage(file: File, clockwise = true): Promise<File> {
  const bitmap = await decodeImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.height
  canvas.height = bitmap.width
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo girar la imagen')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  if ('close' in bitmap) bitmap.close()

  const keepPng = /png/i.test(file.type)
  const type = keepPng ? 'image/png' : 'image/jpeg'
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.9))
  if (!blob) throw new Error('No se pudo girar la imagen')
  const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${base}.${keepPng ? 'png' : 'jpg'}`, { type, lastModified: Date.now() })
}
