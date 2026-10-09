// Clasifica el nombre de una categoria de prenda en un tipo generico.
// Espejo de src/lib/clotheType.ts (frontend): si cambias uno, cambia el otro.
export type ClotheType =
  | 'swimwear' | 'fullbody' | 'outerwear' | 'top' | 'bottom'
  | 'footwear' | 'accessory' | 'sportswear' | 'other'

export function classifyCategory(name: string): ClotheType {
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
