import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** ¿La sesión actual es una sesión de demo (usuario anónimo de Supabase Auth)? */
export function isDemoUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true
}

/**
 * Entra en modo demo: crea una sesión anónima (cada visitante tiene su propio
 * espacio) y la rellena con datos de ejemplo llamando a la función SQL
 * `seed_demo_data()` (migración 0027). Lanza un Error con mensaje legible.
 */
export async function startDemoSession(captchaToken?: string): Promise<void> {
  const { data: current } = await supabase.auth.getSession()
  if (!isDemoUser(current.session?.user)) {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } })
    if (error) {
      throw new Error(
        /anonymous/i.test(error.message)
          ? 'El modo demo no está disponible ahora mismo. Inténtalo más tarde o crea una cuenta.'
          : 'No se ha podido iniciar la demo. Inténtalo de nuevo en un momento.',
      )
    }
  }

  const { error: seedError } = await supabase.rpc('seed_demo_data')
  if (seedError) {
    console.warn('[demo] seed_demo_data falló:', seedError.code, seedError.message, seedError.details)
    await supabase.auth.signOut()
    throw new Error('No se han podido cargar los datos de ejemplo. Inténtalo de nuevo.')
  }
}
