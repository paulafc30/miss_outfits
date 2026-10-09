import { describe, it, expect } from 'vitest'
import { parseImport, MAX_IMPORT_ITEMS } from '../importParse'

const encode = (v: unknown) => Buffer.from(JSON.stringify(v), 'utf-8').toString('base64')

describe('parseImport', () => {
  it('lee un payload válido del bookmarklet', () => {
    const items = [{ platform_id: '123', name: 'Vestido azul', brand: 'Zara', size: 'M', price: 12.5 }]
    expect(parseImport(encode(items))).toEqual(items)
  })

  it('respeta caracteres UTF-8 (ñ, tildes, €)', () => {
    const items = [{ platform_id: '9', name: 'Camisa niño – talla 10 €', price: 3 }]
    expect(parseImport(encode(items))?.[0].name).toBe('Camisa niño – talla 10 €')
  })

  it('tolera que URLSearchParams convierta "+" en espacio', () => {
    const items = [{ platform_id: '1', name: '???>>>', price: 1 }]
    const raw = encode(items)
    expect(raw).toContain('+')
    expect(parseImport(raw.replace(/\+/g, ' '))).toEqual(items)
  })

  it('descarta ítems inválidos pero conserva los buenos', () => {
    const raw = encode([
      { platform_id: '1', name: 'ok', price: 5 },
      { platform_id: '../etc', name: 'id malicioso', price: 5 },
      { platform_id: '3', name: 'x', price: -10 },
      { name: 'sin id' },
      null,
    ])
    expect(parseImport(raw)).toEqual([{ platform_id: '1', name: 'ok', price: 5 }])
  })

  it('rellena valores por defecto', () => {
    expect(parseImport(encode([{ platform_id: '7' }]))).toEqual([{ platform_id: '7', name: '', price: 0 }])
  })

  it('limita el número de ítems', () => {
    const many = Array.from({ length: MAX_IMPORT_ITEMS + 50 }, (_, i) => ({ platform_id: String(i), name: 'x', price: 1 }))
    expect(parseImport(encode(many))).toHaveLength(MAX_IMPORT_ITEMS)
  })

  it('devuelve null con basura, no-array o payload gigante', () => {
    expect(parseImport('')).toBeNull()
    expect(parseImport('%%%no-es-base64%%%')).toBeNull()
    expect(parseImport(encode({ platform_id: '1' }))).toBeNull()
    expect(parseImport('A'.repeat(500_000))).toBeNull()
  })
})
