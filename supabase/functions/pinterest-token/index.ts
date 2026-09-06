import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, APP_ORIGIN } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'

const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar usuario autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    if (!(await checkRateLimit(supabase, user.id, 'pinterest-token', 6))) return rateLimitResponse(corsHeaders)

    const clientId     = Deno.env.get('PINTEREST_CLIENT_ID')!
    const clientSecret = Deno.env.get('PINTEREST_CLIENT_SECRET')!
    const { code, redirect_uri } = await req.json()

    if (typeof code !== 'string' || !code || typeof redirect_uri !== 'string' || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!redirect_uri.startsWith(APP_ORIGIN)) {
      return new Response(JSON.stringify({ error: 'redirect_uri no permitido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Intercambiar code por tokens
    const credentials = btoa(`${clientId}:${clientSecret}`)
    const tokenRes = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      return new Response(JSON.stringify({ error: err }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenData = await tokenRes.json()
    // tokenData: { access_token, refresh_token, token_type, expires_in, scope }
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    await supabase
      .from('profiles')
      .update({
        pinterest_access_token:      tokenData.access_token,
        pinterest_refresh_token:     tokenData.refresh_token ?? null,
        pinterest_token_expires_at:  expiresAt,
      })
      .eq('id', user.id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
