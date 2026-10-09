import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Rate limiting por usuario, respaldado por la funcion SQL check_rate_limit
 * (ver supabase/migrations/0025_rate_limits.sql). Ventanas fijas de
 * `windowSeconds` segundos; `maxRequests` peticiones por ventana y endpoint.
 *
 * Fail-open: si el propio check falla (ej. problema de red/DB), se deja
 * pasar la peticion para no tumbar la app por un fallo ajeno al usuario.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error(`[rate-limit] check failed for ${endpoint}:`, error.message)
    return true
  }
  return data === true
}

export function rateLimitResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: 'Demasiadas peticiones. Espera un momento e intentalo de nuevo.' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

/**
 * Rate limit "con conciencia de demo": las cuentas anonimas (modo demo) tienen
 * un limite por minuto 4 veces menor y un tope diario, para que nadie pueda
 * gastar la cuota de Groq creando sesiones de demo.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  user: { id: string; is_anonymous?: boolean },
  endpoint: string,
  perMinute: number,
): Promise<boolean> {
  if (user.is_anonymous) {
    const okMinute = await checkRateLimit(supabase, user.id, endpoint, Math.max(2, Math.floor(perMinute / 4)))
    if (!okMinute) return false
    return await checkRateLimit(supabase, user.id, `${endpoint}:day`, 15, 86400)
  }
  return await checkRateLimit(supabase, user.id, endpoint, perMinute)
}
