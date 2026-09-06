import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_ORIGIN } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'clothes-images'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface VintedItem {
  vinted_id: string
  name: string
  brand: string
  size: string
  price: number
  image_url: string | null
}

// ─── Estrategia 1: API JSON de Vinted ────────────────────────────────────────

async function fetchViaApi(memberId: string, headers: Record<string, string>): Promise<VintedItem[]> {
  const items: VintedItem[] = []
  const seen = new Set<string>()
  let page = 1

  while (true) {
    const url = `https://www.vinted.es/api/v2/users/${memberId}/items?page=${page}&per_page=96`
    const resp = await fetch(url, {
      headers: {
        ...headers,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (!resp.ok) break

    let json: unknown
    try { json = await resp.json() } catch { break }

    const data = json as Record<string, unknown>
    const rawItems = (data?.items as unknown[]) ?? []
    if (!rawItems.length) break

    for (const raw of rawItems) {
      const r = raw as Record<string, unknown>
      const id = String(r.id ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)

      const photo = ((r.photos as unknown[])?.[0] ?? r.photo) as Record<string, unknown> | undefined
      const imgUrl = (photo?.url ?? photo?.full_size_url ?? null) as string | null

      items.push({
        vinted_id: id,
        name: (r.title as string) ?? '',
        brand: ((r.brand as Record<string,unknown>)?.title as string) ?? (r.brand_title as string) ?? '',
        size: ((r.size as Record<string,unknown>)?.title as string) ?? (r.size_title as string) ?? '',
        price: parseFloat(String((r.price_numeric ?? r.price) ?? '0')) || 0,
        image_url: imgUrl,
      })
    }

    const pagination = data?.pagination as Record<string, unknown> | undefined
    const totalPages = Number(pagination?.total_pages ?? 1)
    if (page >= totalPages) break
    page++
    await new Promise(r => setTimeout(r, 300))
  }

  return items
}

// ─── Estrategia 2: __NEXT_DATA__ en el HTML ───────────────────────────────────

function parseNextData(html: string): VintedItem[] {
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return []

  let data: Record<string, unknown>
  try { data = JSON.parse(match[1]) } catch { return [] }

  // Navegar por props.pageProps o similar hasta encontrar un array de items
  const pageProps = ((data?.props as Record<string,unknown>)?.pageProps ?? {}) as Record<string, unknown>

  // Posibles rutas donde Vinted pone los items
  const candidates = [
    pageProps?.items,
    (pageProps?.initialState as Record<string,unknown>)?.items,
    (pageProps?.user as Record<string,unknown>)?.items,
    (data?.query as Record<string,unknown>)?.items,
  ]

  let rawItems: unknown[] = []
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) { rawItems = c; break }
    // a veces es { items: [...] }
    if (c && typeof c === 'object' && Array.isArray((c as Record<string,unknown>).items)) {
      rawItems = (c as Record<string,unknown>).items as unknown[]
      break
    }
  }

  if (!rawItems.length) return []

  return rawItems.map((raw) => {
    const r = raw as Record<string, unknown>
    const photo = ((r.photos as unknown[])?.[0] ?? r.photo) as Record<string, unknown> | undefined
    return {
      vinted_id: String(r.id ?? ''),
      name: (r.title as string) ?? '',
      brand: ((r.brand as Record<string,unknown>)?.title as string) ?? (r.brand_title as string) ?? '',
      size: ((r.size as Record<string,unknown>)?.title as string) ?? (r.size_title as string) ?? '',
      price: parseFloat(String(r.price_numeric ?? r.price ?? '0')) || 0,
      image_url: (photo?.url ?? photo?.full_size_url ?? null) as string | null,
    }
  }).filter(i => i.vinted_id)
}

// ─── Estrategia 3: regex en img tags ──────────────────────────────────────────

function parseImgRegex(html: string): VintedItem[] {
  const items: VintedItem[] = []
  const seen = new Set<string>()
  const imgRegex = /<img[^>]+alt="([^"]*€[^"]*)"[^>]+src="([^"?]+\?[^"]+)"/gi
  let imgMatch

  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const alt = imgMatch[1]
    const imgSrc = imgMatch[2]
    const before = html.slice(Math.max(0, imgMatch.index - 500), imgMatch.index)
    const idMatch = before.match(/\/items\/(\d+)(?!\/edit)[^/]/) ?? before.match(/\/items\/(\d+)/)
    const vinted_id = idMatch?.[1]
    if (!vinted_id || seen.has(vinted_id)) continue
    seen.add(vinted_id)

    const priceMatch = alt.match(/([\d,]+)\s*€/)
    const brandMatch = alt.match(/marca:\s*([^,]+)/i)
    const sizeMatch = alt.match(/tamaño:\s*([^,]+)/i)

    items.push({
      vinted_id,
      name: alt.split(',')[0].trim(),
      brand: brandMatch?.[1]?.trim() ?? '',
      size: sizeMatch?.[1]?.trim() ?? '',
      price: parseFloat(priceMatch?.[1]?.replace(',', '.') ?? '0'),
      image_url: imgSrc,
    })
  }

  return items
}

// ─── Fetch con estrategias en cascada ─────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

async function fetchAllItems(
  memberId: string,
  debug: boolean,
): Promise<{ items: VintedItem[]; debugInfo?: Record<string, unknown> }> {

  // Estrategia 1: API JSON
  try {
    const apiItems = await fetchViaApi(memberId, BROWSER_HEADERS)
    if (apiItems.length > 0) {
      return { items: apiItems, debugInfo: debug ? { strategy: 'api_json', count: apiItems.length } : undefined }
    }
  } catch (_e) {
    // continuar
  }

  // Estrategia 2 y 3: scraping HTML
  const url = `https://www.vinted.es/member/${memberId}`
  const resp = await fetch(url, { headers: BROWSER_HEADERS })

  if (!resp.ok) {
    return {
      items: [],
      debugInfo: debug ? { error: `HTTP ${resp.status}`, url } : undefined,
    }
  }

  const html = await resp.text()

  // Estrategia 2: __NEXT_DATA__
  const nextDataItems = parseNextData(html)
  if (nextDataItems.length > 0) {
    return {
      items: nextDataItems,
      debugInfo: debug ? { strategy: 'next_data', count: nextDataItems.length } : undefined,
    }
  }

  // Estrategia 3: regex en img
  const regexItems = parseImgRegex(html)

  if (debug) {
    const htmlSample = html.slice(0, 3000)
    const hasNextData = html.includes('__NEXT_DATA__')
    const hasItems = html.includes('/items/')
    const hasEuro = html.includes('€')
    return {
      items: regexItems,
      debugInfo: {
        strategy: 'img_regex',
        count: regexItems.length,
        html_length: html.length,
        has_next_data: hasNextData,
        has_items_links: hasItems,
        has_euro_sign: hasEuro,
        html_sample: htmlSample,
      },
    }
  }

  return { items: regexItems }
}

// ─── Descarga y upload de imagen ─────────────────────────────────────────────

async function uploadImage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  vintedId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const resp = await fetch(imageUrl, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        'Referer': 'https://www.vinted.es/',
      },
    })
    if (!resp.ok) return null

    const blob = await resp.blob()
    const path = `${userId}/${vintedId}.webp`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/webp', upsert: true })

    if (error) return null

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': APP_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': APP_ORIGIN },
    })
  }

  const body = await req.json() as { vinted_member_id: string; debug?: boolean; items?: VintedItem[] }
  const { vinted_member_id, debug = false } = body

  if (!vinted_member_id) {
    return new Response(JSON.stringify({ error: 'Falta vinted_member_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': APP_ORIGIN },
    })
  }

  // Modo "browser-push": el cliente ya scrapeó y manda los items directamente
  const preloadedItems: VintedItem[] | undefined = Array.isArray(body.items) && body.items.length > 0
    ? body.items
    : undefined

  const { items, debugInfo } = preloadedItems
    ? { items: preloadedItems, debugInfo: undefined }
    : await fetchAllItems(vinted_member_id, debug)

  let synced = 0
  let images_ok = 0
  let images_fail = 0

  for (const item of items) {
    let storedImageUrl: string | null = null

    if (item.image_url) {
      storedImageUrl = await uploadImage(supabase, user.id, item.vinted_id, item.image_url)
      if (storedImageUrl) images_ok++
      else images_fail++
    }

    const { error } = await supabase.from('clothes').upsert(
      {
        user_id: user.id,
        vinted_id: item.vinted_id,
        name: item.name,
        brand: item.brand || null,
        size: item.size || null,
        price: item.price || null,
        status: 'en_venta',
        on_vinted: true,
        ...(storedImageUrl ? { image_url: storedImageUrl } : {}),
        notes: `Importado desde Vinted: https://www.vinted.es/items/${item.vinted_id}`,
      },
      { onConflict: 'user_id,vinted_id' },
    )

    if (!error) synced++
  }

  return new Response(
    JSON.stringify({
      total_found: items.length,
      synced,
      images_ok,
      images_fail,
      ...(debug && debugInfo ? { debug: debugInfo } : {}),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': APP_ORIGIN,
      },
    },
  )
})
