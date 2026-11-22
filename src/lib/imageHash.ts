/**
 * Hash perceptual "dHash" de 64 bits (16 caracteres hex) para comparar el parecido visual
 * de dos fotos: la misma foto (o casi: recortada un poco, comprimida, con otro fondo suave)
 * da hashes a poca distancia. No reconoce la misma prenda fotografiada de otra forma.
 */

const CACHE_KEY = 'miss-outfits:img-hash-v1'
const memory = new Map<string, string>()

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(url: string, hash: string) {
  try {
    const c = readCache()
    c[url] = hash
    const keys = Object.keys(c)
    if (keys.length > 600) for (const k of keys.slice(0, keys.length - 600)) delete c[k]
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // localStorage no disponible: solo caché en memoria
  }
}

function hashFromBitmap(bmp: ImageBitmap | HTMLImageElement): string {
  const W = 9
  const H = 8
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  // fondo blanco para que PNG transparentes (recortes) y JPG blancos se comparen igual
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(bmp, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)
  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  let bits = ''
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      bits += gray[y * W + x] > gray[y * W + x + 1] ? '1' : '0'
    }
  }
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

/** Hash de un File (foto recién elegida). */
export async function hashFile(file: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const h = hashFromBitmap(bmp)
    bmp.close?.()
    return h
  } catch {
    return null
  }
}

/** Hash de una foto por URL (con caché). Devuelve null si no se puede descargar. */
export async function hashUrl(url: string): Promise<string | null> {
  const cached = memory.get(url) ?? readCache()[url]
  if (cached) {
    memory.set(url, cached)
    return cached
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const h = await hashFile(await res.blob())
    if (h) {
      memory.set(url, h)
      writeCache(url, h)
    }
    return h
  } catch {
    return null
  }
}

/** Distancia de Hamming entre dos hashes hex de 16 caracteres (0 = idénticos, 64 = opuestos). */
export function hashDistance(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}
