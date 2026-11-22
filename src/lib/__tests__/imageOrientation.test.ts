import { describe, it, expect } from 'vitest'
import { readExifOrientation } from '../imageOrientation'

/** JPEG mínimo con un bloque EXIF que solo contiene la etiqueta de orientación. */
function jpegWithOrientation(o: number, little = true): File {
  const w16 = (n: number) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255])
  const w32 = (n: number) => (little ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >> 24] : [n >> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255])
  const tiff = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8),
    ...w16(1),
    ...w16(0x0112), ...w16(3), ...w32(1), ...w16(o), 0, 0,
    ...w32(0),
  ]
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  const len = exif.length + 2
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...exif, 0xff, 0xd9])
  return new File([bytes], 'f.jpg', { type: 'image/jpeg' })
}

describe('readExifOrientation', () => {
  it('lee la orientación (little y big endian)', async () => {
    expect(await readExifOrientation(jpegWithOrientation(6, true))).toBe(6)
    expect(await readExifOrientation(jpegWithOrientation(8, false))).toBe(8)
    expect(await readExifOrientation(jpegWithOrientation(1))).toBe(1)
  })
  it('devuelve 1 si no es JPEG o no hay EXIF', async () => {
    expect(await readExifOrientation(new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))).toBe(1)
    expect(await readExifOrientation(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'a.jpg', { type: 'image/jpeg' }))).toBe(1)
  })
})
