// PAUSADO: la sincronización con Vinted/Wallapop está oculta en la UI (ver pages/Venta.tsx).
// Este módulo se conserva para reactivarla.
import { z } from 'zod'
import type { PlatformItem } from '@/hooks/useSyncPlatform'

/** Límites defensivos: el payload viaja en la URL, así que es entrada no confiable. */
const MAX_RAW_LENGTH = 400_000
export const MAX_IMPORT_ITEMS = 500

const itemSchema = z.object({
  platform_id: z.string().regex(/^[\w-]{1,40}$/),
  name: z.string().trim().max(200).default(''),
  brand: z.string().trim().max(100).optional(),
  size: z.string().trim().max(40).optional(),
  price: z.number().finite().min(0).max(100_000).default(0),
})

/**
 * Decodifica y valida el payload que genera el bookmarklet de Vinted/Wallapop
 * (JSON en UTF-8 codificado en base64 y pasado por query string).
 * Devuelve solo los ítems válidos, o null si el payload no se puede leer.
 */
export function parseImport(raw: string): PlatformItem[] | null {
  if (!raw || raw.length > MAX_RAW_LENGTH) return null
  try {
    // URLSearchParams convierte '+' en espacio; lo deshacemos antes de decodificar base64.
    const binary = atob(raw.replace(/ /g, '+'))
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return null

    const items: PlatformItem[] = []
    for (const candidate of parsed.slice(0, MAX_IMPORT_ITEMS)) {
      const result = itemSchema.safeParse(candidate)
      if (result.success) items.push(result.data)
    }
    return items
  } catch {
    return null
  }
}
