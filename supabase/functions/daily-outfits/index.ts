import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { callGroqWithRetry, GROQ_MODEL } from '../_shared/groq.ts'
import { classifyCategory } from '../_shared/classify.ts'
import { jsonResponse, internalError, validCoords } from '../_shared/http.ts'

// Las 3 franjas fijas del carrusel del dashboard.
const DAILY_OCCASIONS = ['casual', 'gym', 'cena'] as const
type DailyOccasion = typeof DAILY_OCCASIONS[number]

const OCCASION_LABELS: Record<DailyOccasion, string> = {
  casual: 'casual del dia a dia',
  gym: 'deporte o gimnasio',
  cena: 'salir de noche / cena',
}

function tempToSeason(tempC: number): string {
  if (tempC >= 28) return 'calor intenso (verano, ropa ligera, sin capas)'
  if (tempC >= 20) return 'calor moderado (primavera/verano, ropa ligera)'
  if (tempC >= 12) return 'fresco (otono/primavera, puede necesitar chaqueta)'
  if (tempC >= 5) return 'frio (otono/invierno, necesita capas y abrigo)'
  return 'frio intenso (invierno, abrigo obligatorio)'
}

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { lat, lon } = await req.json().catch(() => ({ lat: null, lon: null }))

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'No auth' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    if (!(await enforceRateLimit(supabase, user, 'daily-outfits', 12))) return rateLimitResponse(corsHeaders)

    const coordsError = validCoords(lat, lon)
    if (coordsError) return jsonResponse({ error: coordsError }, 400)

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC, consistente con created_at)

    // 1. Ver si ya hay sugerencias cacheadas para hoy
    const { data: cached } = await supabase
      .from('daily_outfit_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('suggestion_date', today)

    const cachedByOccasion: Record<string, any> = {}
    for (const row of cached ?? []) cachedByOccasion[row.occasion] = row

    const haveAll = DAILY_OCCASIONS.every((o) => cachedByOccasion[o])

    // Necesitamos el armario en ambos casos: para generar (si faltan) o para
    // hidratar los item_ids cacheados con los datos completos de la prenda.
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)

    const catMap: Record<string, { name: string; type: string }> = {}
    for (const cat of categories ?? []) {
      catMap[cat.id] = { name: cat.name, type: classifyCategory(cat.name) }
    }

    const { data: clothes, error: dbError } = await supabase
      .from('clothes')
      .select('id, name, brand, category_id, colors, tags, size, image_url')
      .eq('user_id', user.id)
      .eq('status', 'closet') // excluye baul, en_venta, vendida y archivada
      .limit(300)

    if (dbError) throw new Error(dbError.message)
    const clothesMap = Object.fromEntries((clothes ?? []).map((c) => [c.id, c]))

    if (haveAll) {
      const outfits = DAILY_OCCASIONS.map((occasion) => {
        const row = cachedByOccasion[occasion]
        return {
          occasion,
          date: row.suggestion_date,
          name: row.name,
          reason: row.reason,
          weather: row.weather,
          rating: row.rating ?? null,
          dislikedItemIds: row.disliked_item_ids ?? [],
          items: (row.item_ids || []).map((id: string) => clothesMap[id]).filter(Boolean),
        }
      })
      return new Response(JSON.stringify({ outfits }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!clothes || clothes.length < 3) {
      return jsonResponse({ error: 'Pocas prendas en el armario para sugerir outfits.' }, 400)
    }

    // 2. Clima (una sola vez, compartido por las 3 ocasiones)
    let weatherDesc = 'clima desconocido'
    let tempC: number | null = null
    if (lat != null && lon != null) {
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

    const inventory = (clothes ?? []).map((c) => {
      const cat = c.category_id ? catMap[c.category_id] : null
      return {
        id: c.id,
        nombre: c.name,
        marca: c.brand || null,
        colores: (c.colors || []).join(', ') || null,
        tags: (c.tags || []).join(', ') || null,
        categoria: cat?.name || null,
        tipo: cat?.type || 'other',
      }
    })

    const gymTypes = ['sportswear']
    const swimTypes = ['swimwear']

    // Representación compacta (menos tokens): id corto, tipo, color principal.
    // Sin marca/tags/categoria — no aportan lo suficiente al estilismo como
    // para justificar el coste en tokens, y "tipo" ya resume la categoria.
    // Bajado de 40 a 25: el modelo de reemplazo (openai/gpt-oss-120b) tiene
    // un limite de tokens/minuto mas bajo (8K vs 12K del anterior) y ademas
    // consume tokens extra en razonamiento interno, asi que hay menos margen.
    const MAX_ITEMS_PER_LIST = 25
    // Antes se cogian las primeras N prendas tal cual venian de la base de
    // datos. Si el armario tiene, por ejemplo, muchas mas camisetas que
    // pantalones y las camisetas ocupan los primeros puestos, un corte
    // "primeras N" podia dejar la lista SIN ningun "bottom"/"fullbody" —
    // entonces la IA nunca podia generar un outfit valido (siempre le
    // faltaba la parte de abajo) y la validacion de estructura lo rechazaba
    // siempre, dejando esa ocasion permanentemente en "Reintentar".
    // Ahora se reparte tipo a tipo (round-robin) para garantizar que cada
    // tipo de prenda presente en el armario tenga hueco en la lista.
    function toCompact(items: typeof inventory) {
      const byType = new Map<string, typeof items>()
      for (const item of items) {
        const bucket = byType.get(item.tipo)
        if (bucket) bucket.push(item)
        else byType.set(item.tipo, [item])
      }
      const types = [...byType.keys()]
      const picked: typeof items = []
      let i = 0
      while (picked.length < MAX_ITEMS_PER_LIST && types.length > 0) {
        const t = types[i % types.length]
        const bucket = byType.get(t)!
        const next = bucket.shift()
        if (next) picked.push(next)
        if (bucket.length === 0) {
          types.splice(i % types.length, 1)
          continue // no incrementar i, el siguiente tipo ya ocupa este indice
        }
        i++
      }
      return picked.map((i) => ({
        id: i.id,
        n: i.nombre,
        t: i.tipo,
        c: i.colores,
      }))
    }

    // "cena" y "casual" usan exactamente el mismo filtro (todo menos deporte
    // y bano) — antes se mandaba la lista completa dos veces, que era lo que
    // reventaba el limite de tokens por minuto de Groq.
    const nonGymItems = inventory.filter((item) => !gymTypes.includes(item.tipo) && !swimTypes.includes(item.tipo))
    const gymItems = inventory.filter((item) => gymTypes.includes(item.tipo) || item.tipo === 'footwear' || item.tipo === 'accessory' || item.tipo === 'other')

    const tempRule = tempC !== null
      ? `Temperatura actual: ${tempC}C. ${tempToSeason(tempC)}. Adapta la eleccion al clima (${tempC < 15 ? 'prioriza outerwear y capas' : tempC > 25 ? 'evita outerwear, prioriza ropa ligera' : 'capas opcionales'}).`
      : ''

    // 3. Un único prompt: pide 1 outfit por cada ocasión que falte
    const missing = DAILY_OCCASIONS.filter((o) => !cachedByOccasion[o])
    const missingNonGym = missing.filter((o) => o !== 'gym')

    // Historial de días anteriores (no de hoy) por ocasión: sirve para (a)
    // no repetir la combinación del último día y (b) aprender de las
    // valoraciones (👍/👎) que la usuaria le puso a outfits anteriores.
    const { data: history } = await supabase
      .from('daily_outfit_suggestions')
      .select('suggestion_date, occasion, item_ids, rating, disliked_item_ids')
      .eq('user_id', user.id)
      .neq('suggestion_date', today)
      .order('suggestion_date', { ascending: false })
      .limit(90)

    function namesOf(itemIds: string[]): string {
      return itemIds
        .map((id) => clothesMap[id]?.name)
        .filter(Boolean)
        .join(' + ')
    }

    function historyNoteFor(occasion: DailyOccasion): string {
      const rows = (history ?? []).filter((h) => h.occasion === occasion)
      if (rows.length === 0) return ''

      const lines: string[] = []
      const last = rows[0] // ordenado desc por fecha, el primero es el más reciente
      const lastNames = namesOf(last.item_ids || [])
      if (lastNames) lines.push(`Ultima vez (${last.suggestion_date}) se sugirio: ${lastNames}. NO repitas exactamente esta misma combinacion.`)

      const liked = rows.filter((h) => h.rating === 'positive').slice(0, 4)
        .map((h) => namesOf(h.item_ids || [])).filter(Boolean)
      if (liked.length > 0) lines.push(`Le gustaron antes estos estilos (NO los repitas tal cual, son solo referencia de que tipo de combinacion/paleta le funciona, el outfit de hoy debe ser diferente): ${liked.join(' | ')}.`)

      const negativeRows = rows.filter((h) => h.rating === 'negative').slice(0, 4)

      // Si señaló prendas concretas que no combinaban, es una pista mucho más
      // precisa que descartar todo el outfit: la prenda en sí puede estar
      // bien, lo que falló es ESA combinacion con ESAS otras prendas.
      const specificFlags = negativeRows
        .filter((h) => Array.isArray(h.disliked_item_ids) && h.disliked_item_ids.length > 0)
        .map((h) => {
          const badNames = h.disliked_item_ids!.map((id: string) => clothesMap[id]?.name).filter(Boolean)
          const restNames = (h.item_ids || []).filter((id: string) => !h.disliked_item_ids!.includes(id))
            .map((id: string) => clothesMap[id]?.name).filter(Boolean)
          if (badNames.length === 0) return null
          return restNames.length > 0
            ? `"${badNames.join(', ')}" no combinaba bien con "${restNames.join(' + ')}"`
            : `"${badNames.join(', ')}" no funcionó en ese outfit`
        })
        .filter(Boolean)
      if (specificFlags.length > 0) lines.push(`Prendas que fallaron en combinaciones anteriores (evita repetir justo esas combinaciones, pero la prenda en si puede usarse de otra forma): ${specificFlags.join('; ')}.`)

      // El resto de negativos sin prenda señalada: nota genérica de siempre.
      const genericDisliked = negativeRows
        .filter((h) => !Array.isArray(h.disliked_item_ids) || h.disliked_item_ids.length === 0)
        .map((h) => namesOf(h.item_ids || [])).filter(Boolean)
      if (genericDisliked.length > 0) lines.push(`Combinaciones que NO le gustaron en general (evita algo muy similar): ${genericDisliked.join(' | ')}.`)

      return lines.length > 0 ? `Historial para "${occasion}": ${lines.join(' ')}` : ''
    }

    // Exclusión DURA (no solo instrucción al modelo) de las prendas usadas la
    // última vez para esa ocasión: si el armario tiene alternativas de sobra,
    // ni siquiera se las ofrecemos a la IA, así el "no repitas" deja de
    // depender de que el modelo obedezca la instrucción. Si excluirlas deja
    // muy pocas prendas (armario pequeño), no excluimos nada — ahí ya toca
    // confiar en la instrucción de texto, repetir algo es preferible a un
    // outfit incompleto.
    // Antes solo se excluia el ultimo dia. Si el armario es pequeño, eso deja
    // que el mismo outfit vuelva a salir cada 2 dias en cuanto "gana turno"
    // de nuevo (sobre todo si encima el usuario le da 👍, que reforzaba
    // devolverlo como "inspiracion"). Ahora se excluyen las ultimas 3
    // sugerencias por ocasion (le haya gustado o no), asi hace falta pasar
    // por mas variedad del armario antes de que algo se repita.
    function lastItemIdsFor(occasion: DailyOccasion): string[] {
      const rows = (history ?? []).filter((h) => h.occasion === occasion).slice(0, 3)
      return [...new Set(rows.flatMap((r) => r.item_ids ?? []))]
    }
    function poolExcluding(pool: typeof inventory, excludeIds: string[], minRemaining: number) {
      if (excludeIds.length === 0) return pool
      const filtered = pool.filter((i) => !excludeIds.includes(i.id))
      return filtered.length >= minRemaining ? filtered : pool
    }

    const nonGymStructureRule = `DEBE incluir: o bien 1 "top" + 1 "bottom", o bien 1 "fullbody" (vestido/mono). Opcional: 1 "outerwear" si el clima lo requiere, y maximo 1 "footwear" y 1 "accessory". PROHIBIDO mezclar swimwear. PROHIBIDO outfit sin parte de abajo (bottom o fullbody): un "top" solo con "accessory" (anillo, bolso, collar...) NO es un outfit valido, siempre falta la parte de abajo.`
    const gymStructureRule = `DEBE incluir: 1 prenda deportiva (tipo sportswear) + opcionalmente calzado deportivo. NO uses top/bottom normales ni accesorios innecesarios.`

    const sections: string[] = []
    if (missingNonGym.length > 0) {
      const historyNotes = missingNonGym.map(historyNoteFor).filter(Boolean).join('\n')
      const excludeIds = missingNonGym.flatMap(lastItemIdsFor)
      const pool = poolExcluding(nonGymItems, excludeIds, 6)
      sections.push(`OCASIONES "${missingNonGym.join('" y "')}" (misma lista de prendas para ambas, pero cada una es un outfit DISTINTO):
Prendas disponibles: ${JSON.stringify(toCompact(pool))}
Regla de estructura: ${nonGymStructureRule}${historyNotes ? `\n${historyNotes}` : ''}`)
    }
    if (missing.includes('gym')) {
      const historyNotes = historyNoteFor('gym')
      const pool = poolExcluding(gymItems, lastItemIdsFor('gym'), 3)
      sections.push(`OCASION "gym":
Prendas disponibles: ${JSON.stringify(toCompact(pool))}
Regla de estructura: ${gymStructureRule}${historyNotes ? `\n${historyNotes}` : ''}`)
    }

    const prompt = `Eres un estilista personal experto en moda. Genera EXACTAMENTE 1 outfit para cada una de estas ocasiones: ${missing.join(', ')}. Usa solo prendas de la lista correspondiente (formato prenda: id, n=nombre, t=tipo, c=colores).

${sections.join('\n\n')}

CLIMA: ${weatherDesc}
${tempRule}

OTRAS REGLAS:
- Usa SOLO ids de prendas de la lista correspondiente a esa ocasion
- 3-5 prendas por outfit maximo
- El "reason" explica brevemente por que combina bien y es apropiado (max 60 palabras)

Responde UNICAMENTE con un objeto JSON valido, sin texto extra ni markdown, con esta forma exacta:
{"outfits":[{"occasion":"casual","name":"nombre creativo","item_ids":["uuid1","uuid2"],"reason":"..."}]}
(incluye solo las ocasiones pedidas: ${missing.join(', ')})`

    const groqRes = await callGroqWithRetry({
      model: GROQ_MODEL,
      reasoning_effort: 'low', // solo necesitamos el JSON, no razonamiento largo
      // gpt-oss es un modelo "razonador": sin forzar json_object a veces
      // mete texto de razonamiento antes/despues del JSON (o lo corta),
      // lo que rompía el parseo manual con regex. json_object hace que
      // el propio Groq garantice una salida JSON valida.
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un estilista de moda. Respondes SOLO con un objeto JSON valido, sin texto extra, sin bloques de codigo markdown.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 900,
      temperature: 0.7,
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      throw new Error(`Groq API error: ${err}`)
    }

    const groqData = await groqRes.json()
    const rawText = groqData.choices?.[0]?.message?.content ?? '{"outfits":[]}'
    let generated: any[]
    try {
      const parsed = JSON.parse(rawText)
      generated = Array.isArray(parsed) ? parsed : (parsed.outfits ?? [])
    } catch {
      throw new Error(`La IA no devolvio JSON valido: ${rawText.slice(0, 200)}`)
    }

    // Validacion + preparar filas a insertar.
    // Nota: antes se descartaba el outfit entero si no encontraba un tipo
    // "bottom"/"top"/"fullbody" segun classifyCategory(), pero esa regex
    // depende de que el usuario nombre sus categorias de forma "estandar"
    // (p.ej. "Pantalones"). Si sus categorias tienen otros nombres, la
    // deteccion de tipo falla y el outfit se descartaba silenciosamente
    // SIEMPRE, dejando ese hueco vacio dia tras dia.
    //
    // Ahora exigimos al menos 2 prendas validas, MAS (si el armario tiene
    // prendas detectables como "bottom"/"fullbody" para esa ocasion) que el
    // outfit realmente incluya una: sin esto la IA a veces sugiere solo un
    // top + un accesorio (p.ej. camiseta + anillo), que no es un outfit
    // completo. El check solo se aplica cuando SABEMOS que hay parte de
    // abajo disponible en el armario, para no repetir el bug de antes con
    // categorias no estandar.
    function itemType(id: string): string {
      const c = clothesMap[id]
      const cat = c?.category_id ? catMap[c.category_id] : null
      return cat?.type || 'other'
    }
    const nonGymHasBottomOption = nonGymItems.some((i) => i.tipo === 'bottom' || i.tipo === 'fullbody')

    const rowsToInsert: any[] = []
    for (const occasion of missing) {
      const outfit = generated.find((o: any) => o.occasion === occasion)
      const validIds = Array.isArray(outfit?.item_ids)
        ? outfit.item_ids.filter((id: string) => clothesMap[id])
        : []
      if (!outfit || validIds.length < 2) continue

      if (occasion !== 'gym' && nonGymHasBottomOption) {
        const hasBottom = validIds.some((id: string) => {
          const t = itemType(id)
          return t === 'bottom' || t === 'fullbody'
        })
        if (!hasBottom) continue
      }

      rowsToInsert.push({
        user_id: user.id,
        suggestion_date: today,
        occasion,
        name: outfit.name,
        reason: outfit.reason,
        item_ids: validIds,
        weather: weatherDesc,
      })
    }

    if (rowsToInsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('daily_outfit_suggestions')
        .upsert(rowsToInsert, { onConflict: 'user_id,suggestion_date,occasion' })
      if (upsertError) throw new Error(upsertError.message)
    }

    // 4. Releer todo (cacheado + recien generado) y devolver los 3
    const { data: finalRows } = await supabase
      .from('daily_outfit_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('suggestion_date', today)

    const finalByOccasion: Record<string, any> = {}
    for (const row of finalRows ?? []) finalByOccasion[row.occasion] = row

    const outfits = DAILY_OCCASIONS
      .filter((o) => finalByOccasion[o])
      .map((occasion) => {
        const row = finalByOccasion[occasion]
        return {
          occasion,
          date: row.suggestion_date,
          name: row.name,
          reason: row.reason,
          weather: row.weather,
          rating: row.rating ?? null,
          dislikedItemIds: row.disliked_item_ids ?? [],
          items: (row.item_ids || []).map((id: string) => clothesMap[id]).filter(Boolean),
        }
      })

    if (outfits.length === 0) {
      return jsonResponse({ error: 'La IA no genero outfits validos. Intenta de nuevo.' }, 400)
    }

    return jsonResponse({ outfits })
  } catch (err) {
    return internalError('daily-outfits', err)
  }
})
