import { describe, it, expect } from 'vitest'
import { extractUrl, extractTitleFromShareText, detectSalePlatform, isImageUrl } from '../sharedItem'

describe('extractUrl', () => {
  it('saca la primera URL http(s) del texto', () => {
    expect(extractUrl('Mira esto https://www.vinted.es/items/123-abc y más')).toBe('https://www.vinted.es/items/123-abc')
    expect(extractUrl('sin enlaces')).toBe('')
  })
})

describe('extractTitleFromShareText', () => {
  it('Wallapop', () => {
    expect(extractTitleFromShareText('Vendo "Chaqueta vaquera" en Wallapop https://p.wallapop.com/i/1')).toBe('Chaqueta vaquera')
  })
  it('Vinted', () => {
    expect(extractTitleFromShareText('Mira "Vestido floral" en Vinted')).toBe('Vestido floral')
  })
  it('devuelve null si no hay título', () => {
    expect(extractTitleFromShareText('')).toBeNull()
    expect(extractTitleFromShareText('hola')).toBeNull()
  })
})

describe('detectSalePlatform / isImageUrl', () => {
  it('detecta la plataforma por dominio', () => {
    expect(detectSalePlatform('https://es.wallapop.com/item/x')).toBe('wallapop')
    expect(detectSalePlatform('https://www.vinted.es/items/1')).toBe('vinted')
    expect(detectSalePlatform('https://example.com')).toBeNull()
    expect(detectSalePlatform('')).toBeNull()
  })
  it('reconoce URLs de imagen', () => {
    expect(isImageUrl('https://x.com/a.jpg?w=1')).toBe(true)
    expect(isImageUrl('https://x.com/a.html')).toBe(false)
  })
})
