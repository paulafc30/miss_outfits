import type { Clothe, Category } from '@/types/database'
import { classifyCategoryType, isNeutralColorName, ClotheType } from '@/lib/clotheType'
import { colorHexByName } from '@/lib/colorPalette'
import { hexToRgb, colorDistance } from '@/lib/colorFamily'

function clotheColorNames(c: Clothe): string[] {
  return c.colors?.length ? c.colors : (c.color ? [c.color] : [])
}

function clotheHexes(c: Clothe): string[] {
  const names = clotheColorNames(c)
  const hexes = c.color_hexes ?? []
  return names.map((n, i) => hexes[i] ?? colorHexByName(n) ?? '').filter(Boolean)
}

function hasNeutralColor(c: Clothe): boolean {
  return clotheColorNames(c).some(isNeutralColorName)
}

/**
 * Distancia de color minima (menor = mejor match) entre un candidato y un
 * conjunto de colores de referencia. Las prendas con color neutro (negro,
 * blanco, gris, beige) siempre puntuan bien porque combinan con casi todo,
 * sin llegar a ganarle a un match exacto de color.
 */
function colorScore(candidate: Clothe, referenceHexes: string[]): number {
  if (hasNeutralColor(candidate)) return 20
  const candHexes = clotheHexes(candidate)
  if (candHexes.length === 0 || referenceHexes.length === 0) return 60
  let best = Infinity
  for (const ch of candHexes) {
    const crgb = hexToRgb(ch)
    if (!crgb) continue
    for (const rh of referenceHexes) {
      const rrgb = hexToRgb(rh)
      if (!rrgb) continue
      const d = colorDistance(crgb, rrgb)
      if (d < best) best = d
    }
  }
  return best === Infinity ? 60 : best
}

export function categoryTypeMap(categories: Category[]): Record<string, ClotheType> {
  const map: Record<string, ClotheType> = {}
  for (const cat of categories) map[cat.id] = classifyCategoryType(cat.name)
  return map
}

export interface CompleteLookSuggestion {
  clothe: Clothe
  type: 'footwear' | 'accessory'
}

/**
 * Sugerencias de "completa tu look": zapatos/bolsos/accesorios del armario
 * que combinan por color con las prendas de referencia, de mejor a peor
 * match. Reglas simples de color (sin IA): rapido, sin limite de tokens.
 */
export function suggestCompleteLook(
  referenceClothes: Clothe[],
  pool: Clothe[],
  typeById: Record<string, ClotheType>,
  excludeIds: Set<string> = new Set(),
  limit = 8,
): CompleteLookSuggestion[] {
  const referenceHexes = referenceClothes.flatMap(clotheHexes)

  const candidates = pool
    .filter((c) => !excludeIds.has(c.id))
    .map((c) => {
      const type = c.category_id ? typeById[c.category_id] : undefined
      return type === 'footwear' || type === 'accessory' ? { clothe: c, type } : null
    })
    .filter((x): x is { clothe: Clothe; type: 'footwear' | 'accessory' } => x !== null)

  return candidates
    .map((c) => ({ ...c, score: colorScore(c.clothe, referenceHexes) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ clothe, type }) => ({ clothe, type }))
}
