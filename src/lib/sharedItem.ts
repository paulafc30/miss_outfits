/**
 * Helpers para pasar datos entre la pantalla de Compartir y los formularios
 * de las páginas destino (armario, venta, wishlist). Se usa sessionStorage
 * para sobrevivir a la navegación pero no a un cierre completo del navegador.
 */

const KEY = 'miss-outfits:shared'

export type ShareTarget = 'armario' | 'venta' | 'wishlist'

export interface SharedPayload {
  target: ShareTarget
  title: string
  text: string
  url: string
}

export function storeSharedPayload(payload: SharedPayload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // ignore (modo privado en Safari, etc.)
  }
}

export function consumeSharedPayload(forTarget: ShareTarget): SharedPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SharedPayload
    if (data.target !== forTarget) return null
    sessionStorage.removeItem(KEY)
    return data
  } catch {
    return null
  }
}

/** Extrae la primera URL http(s) que aparezca en el texto. */
export function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s)]+/i)
  return m ? m[0] : ''
}

/** ¿La URL parece apuntar directamente a una imagen? */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url)
}

/**
 * Intenta extraer el título del producto del texto compartido por las apps
 * típicas de venta de segunda mano. Cada una tiene su patrón:
 *   - Wallapop: `Vendo "TITULO" en Wallapop URL`
 *   - Vinted:   `Mira "TITULO" en Vinted` u otros formatos por idioma
 * Si no encaja en ningún patrón, devuelve null y se cae al og:title.
 */
export function extractTitleFromShareText(text: string): string | null {
  if (!text) return null
  const wallapop = text.match(/(?:vendo|venta)\s+["“”„«»]([^"“”„«»]+)["“”„«»]?\s+en\s+wallapop/i)
  if (wallapop) return wallapop[1].trim()
  const vinted = text.match(/(?:mira|consulta|check)\s*[^"]*["“”„«»]([^"“”„«»]+)["“”„«»]/i)
  if (vinted) return vinted[1].trim()
  // Cualquier texto largo entre comillas como último recurso
  const generic = text.match(/["“”„«»]([^"“”„«»]{4,})["“”„«»]/)
  if (generic) return generic[1].trim()
  return null
}

export type SalePlatform = 'wallapop' | 'vinted'

/** Detecta si la URL pertenece a Wallapop o Vinted. */
export function detectSalePlatform(url: string): SalePlatform | null {
  if (!url) return null
  if (/wallapop\./i.test(url)) return 'wallapop'
  if (/vinted\./i.test(url)) return 'vinted'
  return null
}
