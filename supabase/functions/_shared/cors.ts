// Origen unico permitido para llamar a las Edge Functions desde el navegador.
// Si algun dia hay mas de un dominio de produccion, convertir en lista y
// comprobar el header Origin de la request contra ella.
export const APP_ORIGIN = 'https://miss-outfits.ferava.es'

export const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
