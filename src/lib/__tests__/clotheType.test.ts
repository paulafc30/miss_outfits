import { describe, it, expect } from 'vitest'
import { classifyCategoryType } from '../clotheType'

describe('classifyCategoryType', () => {
  it.each([
    ['Camisetas', 'top'],
    ['Pantalones', 'bottom'],
    ['Vestidos', 'fullbody'],
    ['Zapatos', 'footwear'],
    ['Accesorios', 'accessory'],
    ['Abrigos', 'outerwear'],
    ['Bañadores', 'swimwear'],
    ['Ropa de gym', 'sportswear'],
    ['Cosas varias', 'other'],
  ])('%s -> %s', (name, type) => {
    expect(classifyCategoryType(name)).toBe(type)
  })
})
