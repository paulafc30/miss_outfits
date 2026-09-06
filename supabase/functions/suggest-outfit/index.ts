import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'

// El plan gratuito de Groq tiene un limite de tokens/minuto compartido por
// todas las llamadas (daily-outfits + suggest-outfit + chat-stylist). Si se
// alcanza, Groq responde 429 e indica cuanto esperar en el propio mensaje de
// error (p.ej. "Please try again in 1.3725s"). En vez de fallar directamente,
// esperamos ese tiempo y reintentamos una vez.
async function callGroqWithRetry(body: Record<string, unknown>): Promise<Response> {
  const doFetch = () => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let res = await doFetch()
  if (res.status === 429) {
    const errText = await res.text()
    const match = errText.match(/try again in ([\d.]+)s/i)
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 200 : 2000
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
    res = await doFetch()
  }
  return res
}

const OCCASIONS: Record<string, string> = {
  casual: 'casual del dia a dia',
  trabajo: 'oficina o trabajo profesional',
  cena: 'cena o salida nocturna',
  gym: 'deporte o gimnasio',
  evento: 'evento especial o celebracion',
}

// Clasifica el nombre de una categoria en un tipo de prenda
function classifyCategory(name: string): string {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/bikini|banador|bano|swimwear/.test(n)) return 'swimwear'
  if (/vestido|mono|jumpsuit|overall|enterizo/.test(n)) return 'fullbody'
  if (/abrigo|chaqueta|cazadora|blazer|cardigan|jersey|sudadera|hoodie|anorak/.test(n)) return 'outerwear'
  if (/camiseta|top|blusa|camisa|body|tirante|crop/.test(n)) return 'top'
  if (/pantalon|falda|short|jean|vaquero|leggin|culot/.test(n)) return 'bottom'
  if (/zapato|zapatilla|bota|sandalia|tacón|tacon|calzado/.test(n)) return 'footwear'
  if (/accesorio|bolso|cinturon|bufanda|gorro|joya|collar|pendiente|pulsera|reloj|sombrero|gafas/.test(n)) return 'accessory'
  if (/deporte|gym|sport|running|yoga/.test(n)) return 'sportswear'
  return 'other'
}

// Temperatura en C -> descripcion de temporada
function tempToSeason(tempC: number): string {
  if (tempC >= 28) return 'calor intenso (verano, ropa ligera, sin capas)'
  if (tempC >= 20) return 'calor moderado (primavera/verano, ropa ligera)'
  if (tempC >= 12) return 'fresco (otono/primavera, puede necesitar chaqueta)'
  if (tempC >= 5) return 'frio (otono/invierno, necesita capas y abrigo)'
  return 'frio intenso (invierno, abrigo obligatorio)'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { occasion, lat, lon } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    if (!(await checkRateLimit(supabase, user.id, 'suggest-outfit', 12))) return rateLimitResponse(corsHeaders)

    const ALLOWED_OCCASIONS = ['casual', 'trabajo', 'cena', 'gym', 'evento']
    if (occasion != null && (typeof occasion !== 'string' || !ALLOWED_OCCASIONS.includes(occasion))) {
      return new Response(JSON.stringify({ error: 'occasion invalida' }), { status: 400, headers: corsHeaders })
    }
    if (lat != null && (typeof lat !== 'number' || Number.isNaN(lat))) {
      return new Response(JSON.stringify({ error: 'lat invalida' }), { status: 400, headers: corsHeaders })
    }
    if (lon != null && (typeof lon !== 'number' || Number.isNaN(lon))) {
      return new Response(JSON.stringify({ error: 'lon invalida' }), { status: 400, headers: corsHeaders })
    }

    // Fetch categorias del usuario
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)

    const catMap: Record<string, { name: string; type: string }> = {}
    for (const cat of categories ?? []) {
      catMap[cat.id] = { name: cat.name, type: classifyCategory(cat.name) }
    }

    // Fetch armario
    const { data: clothes, error: dbError } = await supabase
      .from('clothes')
      .select('id, name, brand, category_id, colors, tags, size, image_url')
      .eq('user_id', user.id)
      .eq('status', 'closet') // excluye baul, en_venta, vendida y archivada
      .limit(90)

    if (dbError) throw new Error(dbError.message)
    if (!clothes || clothes.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Pocas prendas en el armario para sugerir outfits.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Clima
    let weatherDesc = 'clima desconocido'
    let tempC: number | null = null
    if (lat && lon) {
      try {
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`
        )
        const wData = await wRes.json()
        tempC = Math.round(wData.current?.temperature_2m)
        const wLabel = weatherCodeToLabel(wData.current?.weathercode)
        weatherDesc = `${tempC}C, ${wLabel}, ${tempToSeason(tempC!)}`
      } catch { /* opcional */ }
    }

    // Construir inventario enriquecido con tipo de prenda
    const inventory = clothes.map((c) => {
      const cat = c.category_id ? catMap[c.category_id] : null
      return {
        id: c.id,
        nombre: c.name,
        marca: c.brand || null,
        colores: (c.colors || []).join(', ') || null,
        tags: (c.tags || []).join(', ') || null,
        categoria: cat?.name || null,
        tipo: cat?.type || 'other',  // top | bottom | fullbody | outerwear | footwear | accessory | sportswear | swimwear | other
      }
    })

    // Filtrar prendas incompatibles con la ocasion o la temperatura
    const gymTypes = ['sportswear']
    const swimTypes = ['swimwear']

    const availableItems = inventory.filter((item) => {
      if (occasion === 'gym') return gymTypes.includes(item.tipo) || item.tipo === 'footwear' || item.tipo === 'accessory' || item.tipo === 'other'
      // Para ocasiones no-gym, excluir ropa de deporte y swimwear
      if (gymTypes.includes(item.tipo)) return false
      if (swimTypes.includes(item.tipo)) return false
      return true
    })

    if (availableItems.length < 3) {
      return new Response(
        JSON.stringify({ error: 'No hay suficientes prendas disponibles para esta ocasion.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Representacion compacta para el prompt (menos tokens): antes se
    // mandaba el objeto completo (nombre, marca, colores, tags, categoria,
    // tipo) sin limite de cantidad, lo que con armarios grandes reventaba
    // el limite de tokens/minuto de Groq. "tipo" ya resume la categoria.
    //
    // El corte se hace tipo a tipo (round-robin), no "las primeras N": si
    // se cortara tal cual venian de la base de datos, un armario con muchas
    // mas camisetas que pantalones podia dejar la lista sin ningun "bottom",
    // y entonces ningun outfit generado podia tener parte de abajo.
    const MAX_ITEMS_FOR_PROMPT = 35
    function toCompactBalanced(items: typeof availableItems) {
      const byType = new Map<string, typeof items>()
      for (const item of items) {
        const bucket = byType.get(item.tipo)
        if (bucket) bucket.push(item)
        else byType.set(item.tipo, [item])
      }
      const types = [...byType.keys()]
      const picked: typeof items = []
      let i = 0
      while (picked.length < MAX_ITEMS_FOR_PROMPT && types.length > 0) {
        const t = types[i % types.length]
        const bucket = byType.get(t)!
        const next = bucket.shift()
        if (next) picked.push(next)
        if (bucket.length === 0) {
          types.splice(i % types.length, 1)
          continue
        }
        i++
      }
      return picked
    }
    const compactAvailable = toCompactBalanced(availableItems).map((i) => ({
      id: i.id,
      n: i.nombre,
      t: i.tipo,
      c: i.colores,
    }))

    const occasionLabel = OCCASIONS[occasion] || occasion
    const isGym = occasion === 'gym'

    const structureRule = isGym
      ? 'Cada outfit de gym DEBE incluir: 1 prenda deportiva (tipo sportswear) + opcionalmente calzado deportivo. NO incluyas prendas de tipo top/bottom normales ni accesorios innecesarios.'
      : `Cada outfit DEBE incluir:
- O bien 1 prenda "top" + 1 prenda "bottom"
- O bien 1 prenda "fullbody" (vestido, mono, jumpsuit)
- Opcionalmente: 1 prenda "outerwear" si el clima lo requiere
- Opcionalmente: 1 "footwear" y/o 1 "accessory" (maximo 1 de cada)
PROHIBIDO: combinar "swimwear" con cualquier otra categoria. PROHIBIDO: poner solo accesorios sin top+bottom o fullbody. PROHIBIDO: outfit sin parte de abajo (bottom o fullbody).`

    const tempRule = tempC !== null
      ? `Temperatura actual: ${tempC}C. ${tempToSeason(tempC)}. Adapta la eleccion de prendas al clima (${tempC < 15 ? 'prioriza outerwear y capas' : tempC > 25 ? 'evita outerwear, prioriza ropa ligera' : 'capas opcionales'}).`
      : ''

    const prompt = `Eres un estilista personal experto en moda. El usuario tiene este armario (formato prenda: id, n=nombre, t=tipo, c=colores):
${JSON.stringify(compactAvailable)}

OCASION: ${occasionLabel}
CLIMA: ${weatherDesc}
${tempRule}

REGLAS OBLIGATORIAS DE ESTRUCTURA:
${structureRule}

OTRAS REGLAS:
- Usa SOLO IDs de prendas de la lista proporcionada
- 3-5 prendas por outfit maximo
- Los 3 outfits deben ser distintos entre si (no repitas las mismas prendas en todos)
- Combina colores de forma armoniosa
- El "reason" explica brevemente por que combina bien y es apropiado para la ocasion y clima (max 60 palabras)

Responde UNICAMENTE con un objeto JSON valido, sin texto extra ni markdown:
{"outfits":[{"name":"nombre creativo del look","item_ids":["uuid1","uuid2","uuid3"],"reason":"explicacion"}]}`

    const groqRes = await callGroqWithRetry({
      // llama-3.3-70b-versatile fue descomisionado por Groq el 2026-08-16.
      // Reemplazo recomendado por Groq: openai/gpt-oss-120b.
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low', // solo necesitamos el JSON, no razonamiento largo
      // gpt-oss es un modelo "razonador": sin forzar json_object a veces
      // mete texto de razonamiento antes/despues del JSON (o lo corta),
      // lo que rompía el parseo manual con regex.
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un estilista de moda. Respondes SOLO con un objeto JSON valido, sin texto extra, sin bloques de codigo markdown.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.6,
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      throw new Error(`Groq API error: ${err}`)
    }

    const groqData = await groqRes.json()
    const rawText = groqData.choices?.[0]?.message?.content ?? '{"outfits":[]}'
    let outfits: any[]
    try {
      const parsed = JSON.parse(rawText)
      outfits = Array.isArray(parsed) ? parsed : (parsed.outfits ?? [])
    } catch {
      throw new Error(`La IA no devolvio JSON valido: ${rawText.slice(0, 200)}`)
    }

    // Validacion basica: rechazar outfits sin top+bottom o fullbody (salvo gym)
    const clothesMap = Object.fromEntries(clothes.map((c) => [c.id, c]))
    const enriched = outfits
      .filter((outfit: any) => {
        if (!Array.isArray(outfit.item_ids) || outfit.item_ids.length < 2) return false
        if (isGym) return true
        const types = outfit.item_ids
          .map((id: string) => {
            const c = clothesMap[id]
            return c?.category_id ? catMap[c.category_id]?.type : 'other'
          })
        const hasBottom = types.includes('bottom')
        const hasFullbody = types.includes('fullbody')
        const hasTop = types.includes('top')
        return hasFullbody || (hasTop && hasBottom)
      })
      .map((outfit: any) => ({
        name: outfit.name,
        reason: outfit.reason,
        items: (outfit.item_ids || []).map((id: string) => clothesMap[id]).filter(Boolean),
        weather: weatherDesc,
      }))

    if (enriched.length === 0) {
      return new Response(
        JSON.stringify({ error: 'La IA no genero outfits validos. Intenta de nuevo.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    return new Response(JSON.stringify({ outfits: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'despejado'
  if (code <= 3) return 'parcialmente nublado'
  if (code <= 49) return 'niebla'
  if (code <= 59) return 'llovizna'
  if (code <= 69) return 'lluvia'
  if (code <= 79) return 'nieve'
  if (code <= 99) return 'tormenta'
  return 'variable'
}
