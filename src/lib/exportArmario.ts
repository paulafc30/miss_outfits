import { supabase } from '@/lib/supabase'
import type { Category, Clothe, Outfit, OutfitItem, Season, Wear } from '@/types/database'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = keys.join(',')
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(',')).join('\n')
  return `${header}\n${body}`
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportArmario() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Fetch clothes, categories, seasons, outfits, outfit items
  const [
    { data: clothesRaw },
    { data: categoriesRaw },
    { data: seasonsRaw },
    { data: clotheSeasonsRaw },
    { data: outfitsRaw },
    { data: outfitItemsRaw },
    { data: wearsRaw },
  ] = await Promise.all([
    supabase.from('clothes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('categories').select('*').eq('user_id', user.id),
    supabase.from('seasons').select('*').or(`user_id.eq.${user.id},is_global.eq.true`),
    supabase.from('clothe_seasons').select('clothe_id, season_id'),
    supabase.from('outfits').select('*').eq('user_id', user.id),
    supabase.from('outfit_items').select('*'),
    supabase.from('wears').select('*').eq('user_id', user.id).order('wear_date', { ascending: false }),
  ])

  // El cliente de Supabase no está tipado con `Database`, así que fijamos aquí los tipos de filas.
  const clothes = (clothesRaw ?? []) as Clothe[]
  const categories = (categoriesRaw ?? []) as Category[]
  const seasons = (seasonsRaw ?? []) as Season[]
  const clotheSeasons = (clotheSeasonsRaw ?? []) as { clothe_id: string; season_id: string }[]
  const outfits = (outfitsRaw ?? []) as Outfit[]
  const outfitItems = (outfitItemsRaw ?? []) as OutfitItem[]
  const wears = (wearsRaw ?? []) as Wear[]

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const seasonMap = Object.fromEntries(seasons.map((s) => [s.id, s.name]))

  // Build season names per clothe
  const clotheSeasonsMap: Record<string, string[]> = {}
  for (const cs of clotheSeasons) {
    if (!clotheSeasonsMap[cs.clothe_id]) clotheSeasonsMap[cs.clothe_id] = []
    clotheSeasonsMap[cs.clothe_id].push(seasonMap[cs.season_id] ?? cs.season_id)
  }

  // Build outfit clothe names per outfit
  const outfitClotheMap: Record<string, string[]> = {}
  for (const oi of outfitItems) {
    if (!outfitClotheMap[oi.outfit_id]) outfitClotheMap[oi.outfit_id] = []
    const clothe = clothes.find((c) => c.id === oi.clothe_id)
    if (clothe) outfitClotheMap[oi.outfit_id].push(clothe.name)
  }

  const clotheRows = clothes.map((c) => ({
    id: c.id,
    nombre: c.name,
    categoria: (c.category_id && catMap[c.category_id]) || '',
    marca: c.brand ?? '',
    talla: c.size ?? '',
    colores: (c.colors ?? []).join(' / '),
    material: c.material ?? '',
    temporadas: (clotheSeasonsMap[c.id] ?? []).join(' / '),
    etiquetas: (c.tags ?? []).join(', '),
    estado: c.status,
    precio: c.price ?? '',
    notas: c.notes ?? '',
    imagen: c.image_url ?? '',
    creada: c.created_at?.slice(0, 10) ?? '',
  }))

  const outfitRows = outfits.map((o) => ({
    id: o.id,
    nombre: o.name,
    prendas: (outfitClotheMap[o.id] ?? []).join(' / '),
    creado: o.created_at?.slice(0, 10) ?? '',
  }))

  const wearRows = wears.map((w) => {
    const clothe = clothes.find((c) => c.id === w.clothe_id)
    const outfit = outfits.find((o) => o.id === w.outfit_id)
    return {
      fecha: w.wear_date,
      prenda: clothe?.name ?? '',
      outfit: outfit?.name ?? '',
      planificado: w.planned ? 'Sí' : 'No',
      notas: w.notes ?? '',
    }
  })

  const now = new Date().toISOString().slice(0, 10)

  // Export as JSON bundle
  const bundle = {
    exportado: now,
    prendas: clotheRows,
    outfits: outfitRows,
    historial_looks: wearRows,
  }
  downloadFile(JSON.stringify(bundle, null, 2), `miss-outfits-${now}.json`, 'application/json')

  // Also export clothes CSV
  downloadFile(toCsv(clotheRows), `miss-outfits-prendas-${now}.csv`, 'text/csv;charset=utf-8;')
}
