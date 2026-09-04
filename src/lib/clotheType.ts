/**
 * Clasificación de una categoría en un "tipo" de prenda, a partir de su
 * nombre. Misma lógica (a propósito, mantenerla sincronizada) que
 * classifyCategory() en supabase/functions/daily-outfits e
 * supabase/functions/suggest-outfit — ahí vive server-side (Deno), aquí
 * la necesitamos client-side para "Completa tu look".
 */
export type ClotheType =
  | 'top'
  | 'bottom'
  | 'fullbody'
  | 'outerwear'
  | 'footwear'
  | 'accessory'
  | 'sportswear'
  | 'swimwear'
  | 'other'

export function classifyCategoryType(name: string): ClotheType {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/bikini|banador|bano|swimwear/.test(n)) return 'swimwear'
  if (/vestido|mono|jumpsuit|overall|enterizo/.test(n)) return 'fullbody'
  if (/abrigo|chaqueta|cazadora|blazer|cardigan|jersey|sudadera|hoodie|anorak/.test(n)) return 'outerwear'
  if (/camiseta|top|blusa|camisa|body|tirante|crop/.test(n)) return 'top'
  if (/pantalon|falda|short|jean|vaquero|leggin|culot/.test(n)) return 'bottom'
  if (/zapato|zapatilla|bota|sandalia|tacon|calzado/.test(n)) return 'footwear'
  if (/accesorio|bolso|cinturon|bufanda|gorro|joya|collar|pendiente|pulsera|reloj|sombrero|gafas/.test(n)) return 'accessory'
  if (/deporte|gym|sport|running|yoga/.test(n)) return 'sportswear'
  return 'other'
}

const NEUTRAL_COLOR_NAMES = new Set(['blanco', 'negro', 'gris', 'beige'])

/** Colores que combinan con casi cualquier cosa, para no penalizarlos en el match. */
export function isNeutralColorName(name: string): boolean {
  return NEUTRAL_COLOR_NAMES.has(name.toLowerCase())
}
