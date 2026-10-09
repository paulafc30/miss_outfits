import { ClothesStatus } from '@/types/database'

export const STATUS_LABELS: Record<ClothesStatus, string> = {
  closet: 'Armario',
  baul: 'Baúl',
  en_venta: 'En Venta',
  vendida: 'Vendida',
  archivada: 'Archivada',
}

export const STATUS_COLORS: Record<ClothesStatus, string> = {
  closet:    'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  baul:      'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  en_venta:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  vendida:   'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
  archivada: 'bg-surface-soft text-muted',
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return ''
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

/** Llama al endpoint público de microlink.io para extraer metadatos de una URL. */
export async function fetchUrlPreview(url: string): Promise<{
  title?: string
  image?: string
  description?: string
  price?: number
} | null> {
  try {
    const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    const json = await r.json()
    if (json.status !== 'success') return null
    const data = json.data ?? {}
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      // Antes caia al logo del sitio (data.logo) si no habia data.image, lo
      // que en tiendas como Stradivarius mostraba el logo de la marca en vez
      // de la prenda (o directamente nada, si el logo tampoco existia). El
      // logo del sitio nunca es una foto util de la prenda, asi que mejor
      // dejar el campo vacio y que la usuaria suba la imagen a mano.
      image: data.image?.url,
      description: typeof data.description === 'string' ? data.description : undefined,
      price: extractPriceFromMeta(data),
    }
  } catch {
    return null
  }
}

/** Intenta sacar un precio numérico de los metadatos de microlink. */
function extractPriceFromMeta(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const d = data as Record<string, unknown>
  // Algunos marketplaces exponen og:price:amount → microlink puede devolverlo en data.price
  if (typeof d.price === 'number' && isFinite(d.price)) return d.price
  if (typeof d.price === 'string') {
    const n = parseFloat(d.price.replace(',', '.'))
    if (!isNaN(n) && isFinite(n)) return n
  }
  // Fallback: buscar "N €" o "N,N €" en título o descripción
  const haystack = [d.title, d.description].filter((x) => typeof x === 'string').join(' ')
  const m = haystack.match(/(\d+(?:[.,]\d+)?)\s*€/)
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'))
    if (!isNaN(n) && isFinite(n)) return n
  }
  return undefined
}

/**
 * Extrae un mensaje legible de un valor capturado en un `catch` (que en TS es
 * `unknown`). Acepta `Error`, objetos con `message` (p. ej. PostgrestError de
 * Supabase) y cae al texto de respaldo en cualquier otro caso.
 */
export function getErrorMessage(err: unknown, fallback = 'Ha ocurrido un error'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return fallback
}

/**
 * Devuelve la URL normalizada solo si es http(s); si no (p. ej. `javascript:`),
 * devuelve null. Úsala antes de poner una URL escrita por el usuario en un href.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
