import type { Clothe } from '@/types/database'
import { hashDistance } from './imageHash'

export interface DuplicateInput {
  name: string
  brand?: string | null
  categoryId?: string | null
  colors?: string[]
  /** Hash de la foto portada de la prenda nueva (si se pudo calcular). */
  imageHash?: string | null
}

export interface DuplicateMatch {
  clothe: Clothe
  score: number
  reasons: string[]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'para', 'un', 'una', 'a'])

function tokens(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  )
}

/** Parecido entre dos nombres, de 0 a 1 (mezcla Jaccard y contención de tokens). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const jaccard = inter / (ta.size + tb.size - inter)
  const containment = inter / Math.min(ta.size, tb.size)
  return Math.max(jaccard, containment * 0.85)
}

/** Distancia de hash a partir de la cual dos fotos se consideran "la misma foto". */
const IMG_STRONG = 8
const IMG_MEDIUM = 14

/**
 * Busca en `existing` prendas que podrían ser la misma que `input`.
 * `hashes` mapea id de prenda -> hash de su foto portada (solo las que se pudieron calcular).
 */
export function findDuplicates(
  input: DuplicateInput,
  existing: Clothe[],
  hashes: Map<string, string>,
  max = 3,
): DuplicateMatch[] {
  const brand = normalize(input.brand ?? '')
  const colors = new Set((input.colors ?? []).map(normalize))
  const out: DuplicateMatch[] = []

  for (const c of existing) {
    const reasons: string[] = []
    const nameSim = nameSimilarity(input.name, c.name)
    const sameBrand = !!brand && normalize(c.brand ?? '') === brand
    const sameCat = !!input.categoryId && c.category_id === input.categoryId
    const cColors = (c.colors ?? (c.color ? [c.color] : [])).map(normalize)
    const sharedColor = colors.size > 0 && cColors.some((x) => colors.has(x))

    let dist: number | null = null
    const h = hashes.get(c.id)
    if (input.imageHash && h) dist = hashDistance(input.imageHash, h)

    let score = 0
    if (dist !== null && dist <= IMG_STRONG) {
      score += 0.7
      reasons.push('foto casi idéntica')
    } else if (dist !== null && dist <= IMG_MEDIUM) {
      score += 0.35
      reasons.push('foto muy parecida')
    }
    if (nameSim >= 0.85) {
      score += 0.6
      reasons.push('mismo nombre')
    } else if (nameSim >= 0.5) {
      score += 0.3
      reasons.push('nombre parecido')
    }
    if (nameSim >= 0.3 || (dist !== null && dist <= IMG_MEDIUM)) {
      if (sameBrand) { score += 0.1; reasons.push('misma marca') }
      if (sameCat) { score += 0.1; reasons.push('misma categoría') }
      if (sharedColor) { score += 0.1; reasons.push('mismo color') }
    }

    if (score >= 0.6) out.push({ clothe: c, score, reasons })
  }

  return out.sort((a, b) => b.score - a.score).slice(0, max)
}
