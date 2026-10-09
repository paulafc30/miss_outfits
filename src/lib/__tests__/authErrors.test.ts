import { describe, it, expect } from 'vitest'
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '../authErrors'

describe('authErrorMessage', () => {
  it('traduce errores conocidos de Supabase', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toMatch(/no son correctos/)
    expect(authErrorMessage({ message: 'Email not confirmed' })).toMatch(/Confirma tu email/)
    expect(authErrorMessage({ message: 'User already registered' })).toMatch(/Ya existe/)
    expect(authErrorMessage({ message: 'email rate limit exceeded' })).toMatch(/Demasiados intentos/)
  })
  it('no filtra mensajes desconocidos (en inglés) al usuario', () => {
    expect(authErrorMessage({ message: 'some internal gotrue failure xyz' })).not.toMatch(/gotrue/)
    expect(authErrorMessage(null)).toMatch(/Inténtalo de nuevo/)
  })
  it('exige al menos 8 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8)
  })
})
