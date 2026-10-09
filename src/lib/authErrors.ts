/** Traduce los mensajes (en inglés) de Supabase Auth a español para mostrarlos en la UI. */
export const MIN_PASSWORD_LENGTH = 8

export function authErrorMessage(error: { message?: string } | null | undefined): string {
  const m = (error?.message ?? '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'El email o la contraseña no son correctos.'
  if (m.includes('email not confirmed')) return 'Confirma tu email antes de entrar (revisa tu bandeja de entrada).'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese email.'
  if (m.includes('password should be at least') || m.includes('weak password')) return 'La contraseña es demasiado débil o corta.'
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  if (m.includes('same password') || m.includes('different from the old')) return 'La nueva contraseña debe ser distinta de la anterior.'
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'El email no es válido.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}
