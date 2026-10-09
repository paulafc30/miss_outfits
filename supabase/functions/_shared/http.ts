import { corsHeaders } from './cors.ts'

/** Respuesta JSON con cabeceras CORS y Content-Type correctos. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Respuesta para errores inesperados: el detalle se queda en los logs del
 * servidor y al cliente solo le llega un mensaje generico (no filtramos
 * mensajes internos de la base de datos, de Groq, etc.).
 */
export function internalError(context: string, err: unknown, status = 500): Response {
  if (err instanceof SyntaxError) return jsonResponse({ error: 'Peticion invalida.' }, 400)
  console.error(`[${context}]`, err)
  return jsonResponse({ error: 'Ha ocurrido un error inesperado. Intentalo de nuevo en un momento.' }, status)
}

/** lat/lon opcionales: numeros finitos dentro de rango. */
export function validCoords(lat: unknown, lon: unknown): string | null {
  if (lat != null && (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90)) return 'lat invalida'
  if (lon != null && (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180)) return 'lon invalida'
  return null
}
