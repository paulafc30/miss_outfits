import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { callGroqWithRetry, GROQ_MODEL } from '../_shared/groq.ts'
import { classifyCategory } from '../_shared/classify.ts'
import { jsonResponse, internalError, validCoords } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    if (!(await enforceRateLimit(supabase, user, 'chat-stylist', 20))) return rateLimitResponse(corsHeaders)

    const { message, lat, lon, history = [], suggested_ids = [] } = await req.json()
    if (typeof message !== 'string' || !message.trim()) {
      return jsonResponse({ error: 'Missing message' }, 400)
    }
    if (message.length > 1000) {
      return jsonResponse({ error: 'Mensaje demasiado largo (maximo 1000 caracteres).' }, 400)
    }
    const coordsError = validCoords(lat, lon)
    if (coordsError) return jsonResponse({ error: coordsError }, 400)
    // El historial lo manda el cliente: lo validamos para que nadie pueda colar
    // mensajes con rol 'system' ni historiales enormes (inyeccion de prompt y
    // consumo de cuota de Groq).
    if (!Array.isArray(history)) {
      return jsonResponse({ error: 'historial invalido' }, 400)
    }
    const safeHistory: { role: 'user' | 'assistant'; content: string }[] = []
    // Solo miramos los ultimos 8 mensajes (los unicos que se usan en el prompt)
    for (const h of history.slice(-8)) {
      if (
        !h || typeof h !== 'object' ||
        (h.role !== 'user' && h.role !== 'assistant') ||
        typeof h.content !== 'string' || h.content.length > 2000
      ) {
        return jsonResponse({ error: 'historial invalido' }, 400)
      }
      safeHistory.push({ role: h.role, content: h.content })
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!Array.isArray(suggested_ids) || suggested_ids.length > 100 ||
        !suggested_ids.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return jsonResponse({ error: 'suggested_ids invalido' }, 400)
    }
    const cleanMessage = message.trim()

    const [
      { data: clothes },
      { data: categories },
      { data: outfits },
      { data: feedback },
    ] = await Promise.all([
      supabase.from('clothes').select('id, name, category_id, brand, size, colors, status, image_url').eq('status', 'closet').eq('user_id', user.id),
      supabase.from('categories').select('id, name').eq('user_id', user.id),
      supabase.from('outfits').select('id, name').eq('user_id', user.id).limit(10),
      supabase.from('stylist_feedback').select('reply_text, clothe_ids, rating, occasion').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ])

    const catMap: Record<string, string> = Object.fromEntries((categories ?? []).map((c: any) => [c.id, c.name]))

    // Formato compacto para reducir tokens
    // El modelo recibe numeros cortos (1, 2, 3...) en vez de UUIDs: a veces
    // truncaba o acortaba los UUID y las fotos no salian. El numero se traduce
    // a la prenda real aqui, en el servidor.
    const wardrobe = (clothes ?? []) as any[]
    const wardrobeLines = wardrobe.map((c: any, idx: number) => {
      const cat = catMap[c.category_id] ?? '?'
      const type = classifyCategory(cat)
      const colors = (c.colors ?? []).slice(0, 2).join('/')
      const brand = c.brand ? `(${c.brand})` : ''
      return `[${idx + 1}] ${c.name}${brand ? ' ' + brand : ''} [${type}${colors ? ',' + colors : ''}]`
    }).join('\n')

    // Prendas ya sugeridas en esta conversacion (para evitar repeticion)
    const alreadySuggestedIds: string[] = suggested_ids
    const alreadySuggestedNames = alreadySuggestedIds
      .map((id: string) => (clothes ?? []).find((c: any) => c.id === id) as any)
      .filter(Boolean)
      .map((c: any) => c.name)

    // Preferencias
    const posFb = (feedback ?? []).filter((f: any) => f.rating === 'positive').slice(0, 5)
    const negFb = (feedback ?? []).filter((f: any) => f.rating === 'negative').slice(0, 5)
    let preferencesContext = ''
    if (posFb.length > 0 || negFb.length > 0) {
      preferencesContext = '\nPREFERENCIAS:\n'
      posFb.forEach((f: any) => { preferencesContext += `+ ${f.reply_text.slice(0, 80)}\n` })
      negFb.forEach((f: any) => { preferencesContext += `- ${f.reply_text.slice(0, 80)}\n` })
    }

    // Tiempo
    let weatherContext = ''
    if (lat != null && lon != null) {
      try {
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&timezone=auto`
        )
        if (wRes.ok) {
          const w = await wRes.json()
          const temp = Math.round(w.current?.temperature_2m ?? 0)
          const code = w.current?.weathercode ?? 0
          let desc = 'despejado'
          if (code >= 80) desc = 'lluvia fuerte'
          else if (code >= 61) desc = 'lluvia'
          else if (code >= 3) desc = 'nublado'
          const city = (w.timezone ?? '').split('/').pop()?.replace('_', ' ') ?? 'tu ubicacion'
          weatherContext = `Tiempo: ${city} ${temp}C ${desc}.`
        }
      } catch { /* ignorar */ }
    }

    const avoidLine = alreadySuggestedNames.length > 0
      ? `\nPRENDAS YA SUGERIDAS ANTES EN ESTA CONVERSACION (no las repitas salvo que la usuaria lo pida expresamente): ${alreadySuggestedNames.join(', ')}\n`
      : ''

    const systemPrompt = `Eres Ada, asesora de moda. Respondes en espanol, maximo 80 palabras, tono amigable.
Usas SOLO prendas del armario. Nunca inventas ropa.

REGLA - Pedir contexto: Si la pregunta es vaga pregunta la ocasion antes de sugerir.
REGLA - Sin numeros en texto: Jamas escribas los numeros [n] del armario en tu respuesta. Solo en la linea REFS.
REGLA - REFS obligatorio: Si sugieres prendas concretas, la linea REFS debe incluir sus numeros, p. ej. REFS:[3,7,12]. Sin excepcion.
REGLA - Fotos: la app muestra automaticamente las fotos de las prendas de REFS debajo de tu mensaje. Nunca digas que no puedes mostrar fotos ni imagenes.
REGLA - Formato: texto plano, sin negritas ni markdown (nada de ** ni #).
REGLA - Variedad: Cuando pidan mas opciones, sugiere prendas diferentes a las ya mostradas.
${avoidLine}
FORMATO (siempre dos partes):
Texto de respuesta.
REFS:[n1,n2] o REFS:[]
${preferencesContext}${weatherContext ? '\n' + weatherContext : ''}

ARMARIO:
${wardrobeLines || 'Vacio.'}`

    const trimmedHistory = safeHistory.slice(-8) // max 4 turnos = 8 mensajes para controlar tokens

    const messages = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory,
      { role: 'user', content: cleanMessage },
    ]

    const groqRes = await callGroqWithRetry({
      model: GROQ_MODEL,
      reasoning_effort: 'low',
      messages,
      max_tokens: 700, // gpt-oss gasta parte en razonamiento interno; con 250 cortaba la respuesta (y la linea REFS)
      temperature: 0.65,
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      let userMsg = 'Error al conectar con el asistente.'
      try {
        const errJson = JSON.parse(errText)
        if (errJson.error?.code === 'rate_limit_exceeded') userMsg = 'Demasiadas peticiones seguidas. Espera unos segundos e intenta de nuevo.'
        else if (errJson.error?.message) userMsg = errJson.error.message
      } catch { /* mantener mensaje generico */ }
      return new Response(JSON.stringify({ error: userMsg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const groqData = await groqRes.json()
    const raw = groqData.choices?.[0]?.message?.content ?? ''

    // REFS puede venir cortado (sin "]") si el modelo se queda sin tokens.
    const refsMatch = raw.match(/REFS:\s*\[([^\]]*)\]?/)
    const refTokens: string[] = refsMatch?.[1]
      ? refsMatch[1].split(',').map((t: string) => t.trim()).filter(Boolean)
      : []

    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    const picked: any[] = []
    const pushUnique = (c: any) => { if (c && !picked.some((p) => p.id === c.id)) picked.push(c) }
    for (const tok of refTokens) {
      if (/^\d{1,3}$/.test(tok)) {
        pushUnique(wardrobe[Number(tok) - 1])
      } else {
        // compatibilidad: UUID completo o prefijo (>=6 caracteres) de UUID
        const t = tok.toLowerCase().replace(/^id:/, '')
        if (t.length >= 6) pushUnique(wardrobe.find((c: any) => c.id.toLowerCase().startsWith(t)))
      }
    }

    let reply = raw.replace(/\s*REFS:[\s\S]*$/m, '').trim()
    reply = reply.replace(/\[(?:ID:)?[^\]]*\]/g, '')
    reply = reply.replace(/\bcon\s+ID[:\s]+[0-9a-f-]{36}\b/gi, '')
    reply = reply.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    reply = reply.replace(/\*\*|__/g, '')            // sin markdown (el chat muestra texto plano)
    reply = reply.replace(/[ \t]{2,}/g, ' ').replace(/\(\s*\)/g, '').trim()

    // Si el modelo no dio REFS validos pero nombra prendas del armario, las
    // mostramos igualmente (las fotos nunca deberian depender de un formato).
    if (picked.length === 0) {
      const text = norm(reply)
      for (const c of wardrobe) {
        if (picked.length >= 5) break
        const n = norm(String(c.name ?? '')).trim()
        if (n.length >= 4 && text.includes(n)) pushUnique(c)
      }
    }

    const referencedClothes = picked
      .slice(0, 6)
      .map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url }))

    return jsonResponse({ reply, referenced_clothes: referencedClothes, weather: weatherContext })
  } catch (err) {
    // 200 a proposito: supabase.functions.invoke oculta el body en respuestas no-2xx
    // y el chat necesita leer `error` para mostrarlo.
    return internalError('chat-stylist', err, 200)
  }
})
