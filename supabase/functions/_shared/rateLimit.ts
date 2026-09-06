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
