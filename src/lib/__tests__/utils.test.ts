import { describe, it, expect } from 'vitest'
import { safeHttpUrl, getErrorMessage, formatPrice } from '../utils'

describe('safeHttpUrl', () => {
  it('acepta http y https', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeHttpUrl('  http://example.com  ')).toBe('http://example.com/')
  })
  it('rechaza esquemas peligrosos y basura', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>1</script>')).toBeNull()
    expect(safeHttpUrl('no es una url')).toBeNull()
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })
})

describe('getErrorMessage', () => {
  it('lee Error, objetos con message y usa el respaldo', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage({ message: 'de postgrest' })).toBe('de postgrest')
    expect(getErrorMessage('texto', 'respaldo')).toBe('respaldo')
    expect(getErrorMessage(undefined)).toBe('Ha ocurrido un error')
  })
})

describe('formatPrice', () => {
  it('formatea euros y tolera null', () => {
    expect(formatPrice(null)).toBe('')
    expect(formatPrice(12.5)).toContain('12,50')
  })
})
