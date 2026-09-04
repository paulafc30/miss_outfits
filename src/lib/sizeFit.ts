/**
 * Comprobador rápido de si una prenda debería cuadrarle a la usuaria
 * según sus medidas. Trabaja con una tabla genérica de tallas (cm).
 *
 * NO sustituye a la tabla específica de cada marca — las medidas reales
 * varían entre Zara, H&M, Stradivarius, etc. Es una guía aproximada
 * útil cuando no hay tabla disponible.
 */

export type FitVerdict =
  | 'fits'         // entra dentro del rango
  | 'tight'        // un poco justa (hasta 4cm por encima)
  | 'loose'        // un poco holgada (hasta 4cm por debajo)
  | 'too_tight'    // queda pequeña (más de 4cm por encima)
  | 'too_loose'    // queda grande (más de 4cm por debajo)
  | 'unknown'      // no hay datos suficientes

interface SizeRange {
  bust:  [number, number]
  waist: [number, number]
  hips:  [number, number]
}

/** Tabla aproximada (cm) — basada en tallaje europeo estándar femenino. */
const SIZE_CHART: Record<string, SizeRange> = {
  XS:   { bust: [78, 82],  waist: [60, 64],  hips: [84, 88]  },
  S:    { bust: [82, 86],  waist: [64, 68],  hips: [88, 92]  },
  M:    { bust: [86, 90],  waist: [68, 72],  hips: [92, 96]  },
  L:    { bust: [90, 96],  waist: [72, 78],  hips: [96, 102] },
  XL:   { bust: [96, 102], waist: [78, 84],  hips: [102, 108] },
  XXL:  { bust: [102, 110], waist: [84, 92], hips: [108, 116] },
  XXXL: { bust: [110, 118], waist: [92, 100], hips: [116, 124] },
}

/** Tallas numéricas comunes mapeadas a su equivalente en letra. */
const NUMERIC_TO_LETTER: Record<string, string> = {
  '32': 'XS', '34': 'XS',
  '36': 'S',
  '38': 'M',
  '40': 'L',
  '42': 'XL',
  '44': 'XXL',
  '46': 'XXL',
  '48': 'XXXL',
  '50': 'XXXL',
}

function normalizeSize(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase()
  if (SIZE_CHART[trimmed]) return trimmed
  // 'Talla M', 'M ', 'talla 38'…
  // Con \b: sin los limites de palabra, "TALLA M" encontraba antes la "L"
  // suelta dentro de "TALLA" (dos letras L seguidas) que la "M" real,
  // porque el regex probaba alternativas por posicion de izquierda a
  // derecha y "L" aparece antes en la cadena.
  const m = trimmed.match(/\b(XS|XXXL|XXL|XL|L|M|S)\b/)
  if (m && SIZE_CHART[m[1]]) return m[1]
  const num = trimmed.match(/\d{2}/)
  if (num && NUMERIC_TO_LETTER[num[0]]) return NUMERIC_TO_LETTER[num[0]]
  return null
}

interface Measurements {
  bust_cm?: number | null
  waist_cm?: number | null
  hips_cm?: number | null
}

function rangeVerdict(value: number, min: number, max: number): FitVerdict {
  if (value < min - 4) return 'too_loose'
  if (value < min) return 'loose'
  if (value <= max) return 'fits'
  if (value <= max + 4) return 'tight'
  return 'too_tight'
}

/** El veredicto más "serio" entre varios, para mostrar el más relevante. */
function worst(verdicts: FitVerdict[]): FitVerdict {
  const order: FitVerdict[] = ['too_tight', 'too_loose', 'tight', 'loose', 'fits']
  for (const v of order) if (verdicts.includes(v)) return v
  return 'unknown'
}

/**
 * Comprueba si una talla cuadra con las medidas dadas.
 * Devuelve 'unknown' si no hay suficientes datos.
 */
export function checkFit(size: string | null | undefined, m: Measurements): FitVerdict {
  if (!size) return 'unknown'
  const key = normalizeSize(size)
  if (!key) return 'unknown'
  const chart = SIZE_CHART[key]
  if (!chart) return 'unknown'

  const verdicts: FitVerdict[] = []
  if (m.bust_cm != null)  verdicts.push(rangeVerdict(m.bust_cm,  chart.bust[0],  chart.bust[1]))
  if (m.waist_cm != null) verdicts.push(rangeVerdict(m.waist_cm, chart.waist[0], chart.waist[1]))
  if (m.hips_cm != null)  verdicts.push(rangeVerdict(m.hips_cm,  chart.hips[0],  chart.hips[1]))
  if (verdicts.length === 0) return 'unknown'
  return worst(verdicts)
}

interface FitMeta {
  label: string
  short: string
  className: string
}

export const FIT_META: Record<FitVerdict, FitMeta> = {
  fits:       { label: 'Debería quedarte bien',     short: 'Tu talla',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' },
  tight:      { label: 'Te quedará justa',          short: 'Justa',      className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  loose:      { label: 'Te quedará holgada',        short: 'Holgada',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' },
  too_tight:  { label: 'Probablemente pequeña',     short: 'Pequeña',    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' },
  too_loose:  { label: 'Probablemente grande',      short: 'Grande',     className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200' },
  unknown:    { label: 'Sin datos para comparar',   short: '—',          className: 'bg-surface-soft text-muted' },
}
