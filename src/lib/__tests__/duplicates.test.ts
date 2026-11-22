import { describe, it, expect } from 'vitest'
import { findDuplicates, nameSimilarity } from '../duplicates'
import { hashDistance } from '../imageHash'
import type { Clothe } from '@/types/database'

const base = {
  user_id: 'u', category_id: 'cat1', location_id: null, image_url: null, image_path: null, notes: null,
  tags: [], status: 'closet', on_wallapop: false, on_vinted: false, price: null, purchase_price: null,
  brand: null, size: null, color: null, colors: [], color_hexes: [], material: null,
  created_at: '', updated_at: '', listed_at: null,
} as unknown as Clothe
const mk = (o: Partial<Clothe>): Clothe => ({ ...base, ...o } as Clothe)

describe('nameSimilarity', () => {
  it('ignora tildes, mayúsculas y palabras vacías', () => {
    expect(nameSimilarity('Camiseta básica', 'camiseta basica')).toBe(1)
    expect(nameSimilarity('Vestido rojo', 'Vestido de color azul')).toBeLessThan(0.5)
  })
})

describe('hashDistance', () => {
  it('cuenta los bits distintos', () => {
    expect(hashDistance('0000000000000000', '0000000000000000')).toBe(0)
    expect(hashDistance('0000000000000000', 'ffffffffffffffff')).toBe(64)
    expect(hashDistance('0000000000000001', '0000000000000000')).toBe(1)
  })
})

describe('findDuplicates', () => {
  const existing = [
    mk({ id: '1', name: 'Vestido corto rojo', brand: 'Zara', colors: ['Rojo'] }),
    mk({ id: '2', name: 'Pantalón vaquero baggy', brand: 'Bershka', colors: ['Azul'] }),
  ]

  it('detecta el mismo nombre', () => {
    const r = findDuplicates({ name: 'vestido corto rojo' }, existing, new Map())
    expect(r.map((m) => m.clothe.id)).toEqual(['1'])
  })

  it('detecta nombre parecido con misma marca y categoría', () => {
    const r = findDuplicates(
      { name: 'Vestido rojo', brand: 'zara', categoryId: 'cat1', colors: ['Rojo'] },
      existing,
      new Map(),
    )
    expect(r[0]?.clothe.id).toBe('1')
  })

  it('detecta la misma foto aunque el nombre sea distinto', () => {
    const hashes = new Map([['2', 'abcdef0123456789']])
    const r = findDuplicates({ name: 'Otra cosa', imageHash: 'abcdef0123456788' }, existing, hashes)
    expect(r.map((m) => m.clothe.id)).toEqual(['2'])
  })

  it('no avisa con prendas distintas', () => {
    const hashes = new Map([['1', 'ffffffffffffffff'], ['2', '0000000000000000']])
    const r = findDuplicates({ name: 'Falda negra', imageHash: '5555555555555555' }, existing, hashes)
    expect(r).toEqual([])
  })
})
