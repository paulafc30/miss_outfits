import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { jsonResponse, internalError } from '../_shared/http.ts'

/**
 * Elimina la cuenta del usuario autenticado:
 *  1. borra sus archivos de Storage (clothes-images y avatars, carpeta <user_id>/),
 *  2. borra el usuario de auth.users. Todas las tablas propias referencian
 *     auth.users con ON DELETE CASCADE, así que sus datos desaparecen con él
 *     (los comentarios de `feedback` se conservan anonimizados: user_id -> null).
 * Requiere confirmación explícita ({ confirm: 'ELIMINAR' }).
 */
const BUCKETS = ['clothes-images', 'avatars']

async function removeFolder(supabase: SupabaseClient, bucket: string, folder: string) {
  // Listado paginado por si hay muchas imágenes.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 100 })
    if (error) throw new Error(`storage list ${bucket}: ${error.message}`)
    if (!data || data.length === 0) return
    const paths = data.filter((f) => f.id).map((f) => `${folder}/${f.name}`)
    if (paths.length === 0) return
    const { error: rmError } = await supabase.storage.from(bucket).remove(paths)
    if (rmError) throw new Error(`storage remove ${bucket}: ${rmError.message}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { confirm } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    if (!(await checkRateLimit(supabase, user.id, 'delete-account', 3, 3600))) return rateLimitResponse(corsHeaders)

    if (confirm !== 'ELIMINAR') return jsonResponse({ error: 'Confirmacion invalida.' }, 400)

    for (const bucket of BUCKETS) await removeFolder(supabase, bucket, user.id)

    const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
    if (delError) throw new Error(delError.message)

    return jsonResponse({ ok: true })
  } catch (err) {
    return internalError('delete-account', err)
  }
})
