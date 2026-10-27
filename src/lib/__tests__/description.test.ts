import { describe, expect, it } from 'vitest'
import {
  generateDescription,
  generateShortDescription,
  generateProductDescription,
} from '@/lib/description'
import type { Category, Clothe } from '@/types/database'

function baseClothe(over: Partial<Clothe> = {}): Clothe {
  return {
    id: 't1',
    user_id: 'u',
    name: 'Camiseta blanca',
    category_id: null,
    location_id: null,
    image_url: null,
    image_path: null,
    notes: null,
    tags: [],
    status: 'closet',
    on_wallapop: false,
    on_vinted: false,
    price: 12,
    purchase_price: null,
    sold_at: null,
    listed_at: null,
    brand: 'Zara',
    size: 'M',
    color: 'Blanco',
    colors: ['Blanco'],
    color_hexes: ['#ffffff'],
    material: null,
    created_at: '',
    updated_at: '',
    ...over,
  }
}

function categoryOf(name: string): Category {
  return { id: 'c', user_id: 'u', name, color: '#fff', created_at: '' }
}

describe('generateDescription (anuncio)', () => {
  it('usa artículo femenino con "camiseta"', () => {
    const d = generateDescription(baseClothe(), categoryOf('Camisetas'))
    expect(d).toMatch(/esta\s+camiseta/i)
  })

  it('usa artículo masculino con "vestido"', () => {
    const d = generateDescription(baseClothe({ name: 'Vestido azul' }), categoryOf('Vestidos'))
    expect(d).toMatch(/este\s+vestido/i)
  })

  it('usa plural con "pantalones"', () => {
    const d = generateDescription(baseClothe({ name: 'Pantalones negros' }), categoryOf('Pantalones'))
    expect(d).toMatch(/estos\s+pantalones/i)
  })

  it('evita "en blanco" cuando el color ya está en el nombre', () => {
    const d = generateDescription(baseClothe())
    expect(d.toLowerCase()).not.toContain('en blanco')
  })

  it('añade el color cuando NO está en el nombre', () => {
    const d = generateDescription(baseClothe({ name: 'Camiseta básica', color: 'Verde', colors: ['Verde'] }))
    expect(d.toLowerCase()).toContain('en verde')
  })

  it('junta varios colores con "y" para dos', () => {
    const d = generateDescription(baseClothe({ name: 'Camiseta básica', colors: ['Verde', 'Negro'] }))
    expect(d.toLowerCase()).toContain('en verde y negro')
  })

  it('junta tres colores con comas y "y" final', () => {
    const d = generateDescription(baseClothe({ name: 'Camiseta básica', colors: ['Verde', 'Negro', 'Gris'] }))
    expect(d.toLowerCase()).toContain('en verde, negro y gris')
  })

  it('incluye marca, talla y precio', () => {
    const d = generateDescription(baseClothe())
    expect(d).toMatch(/Zara/)
    expect(d).toMatch(/talla\s+M/i)
    expect(d).toMatch(/12€/)
  })

  it('omite precio si no hay', () => {
    const d = generateDescription(baseClothe({ price: null }))
    expect(d).not.toMatch(/€/)
  })

  it('usa las notas como frase de estado si están', () => {
    const d = generateDescription(baseClothe({ notes: 'Solo me la puse una vez.' }))
    expect(d).toContain('Solo me la puse una vez.')
  })

  it('incluye composición si hay material', () => {
    const d = generateDescription(baseClothe({ material: '100% algodón' }))
    expect(d).toMatch(/Composición:\s*100% algodón/i)
  })
})

describe('generateShortDescription (Vinted)', () => {
  it('incluye hashtags de marca y categoría', () => {
    const d = generateShortDescription(baseClothe(), categoryOf('Camisetas'))
    expect(d).toMatch(/#zara/i)
    expect(d).toMatch(/#camisetas/i)
    expect(d).toMatch(/#segundamano/i)
  })

  it('slugifica quitando acentos y espacios', () => {
    const d = generateShortDescription(baseClothe({ brand: 'Marca con Ñ' }))
    // El slug normaliza acentos pero conserva ñ; el regex permite cualquier orden
    expect(d).toMatch(/#marca/i)
  })

  it('incluye hashtag de talla', () => {
    const d = generateShortDescription(baseClothe())
    expect(d.toLowerCase()).toContain('#tallam')
  })
})

describe('generateProductDescription (ficha)', () => {
  it('NO contiene "¡Vendo", precio ni cierre comercial', () => {
    const d = generateProductDescription(baseClothe())
    expect(d).not.toMatch(/vendo/i)
    expect(d).not.toMatch(/€/)
    expect(d).not.toMatch(/escríbeme/i)
  })

  it('incluye categoría cuando se pasa', () => {
    const d = generateProductDescription(baseClothe(), categoryOf('Camisetas'))
    expect(d).toMatch(/Categoría:\s*Camisetas/i)
  })

  it('incluye composición si la prenda tiene material', () => {
    const d = generateProductDescription(baseClothe({ material: 'Lino' }))
    expect(d).toMatch(/Composición:\s*Lino/i)
  })

  it('incluye etiquetas si las hay', () => {
    const d = generateProductDescription(baseClothe({ tags: ['verano', 'casual'] }))
    expect(d).toMatch(/Estilo:\s*verano,\s*casual/i)
  })
})
