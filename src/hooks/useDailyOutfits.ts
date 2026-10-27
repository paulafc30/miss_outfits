import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatISODate } from '@/lib/calendar'

export type DailyOccasion = 'casual' | 'gym' | 'cena'
export type DailyOutfitRating = 'positive' | 'negative'

export interface DailyOutfitItem {
  id: string
  name: string
  brand: string | null
  colors: string[]
  image_url: string | null
}

export interface DailyOutfit {
  occasion: DailyOccasion
  /** Fecha (YYYY-MM-DD) tal cual la guardó el backend — usarla para puntuar, no recalcularla en el cliente. */
  date: string
  name: string
  reason: string
  weather: string
  rating: DailyOutfitRating | null
  /** IDs de las prendas señaladas como "esta no combinaba" en un rating negativo. */
  dislikedItemIds: string[]
  items: DailyOutfitItem[]
}

async function getGeolocation(): Promise<{ lat: number | null; lon: number | null }> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    )
    return { lat: pos.coords.latitude, lon: pos.coords.longitude }
  } catch {
    return { lat: null, lon: null }
  }
}

/**
 * Trae los 3 outfits sugeridos del día (casual, gym, cena) para el
 * carrusel del dashboard. Se cachean en la tabla daily_outfit_suggestions
 * en el backend, así que solo se regeneran con IA una vez por día.
 */
export function useDailyOutfits() {
  const today = formatISODate(new Date())

  return useQuery({
    queryKey: ['daily-outfits', today],
    queryFn: async (): Promise<DailyOutfit[]> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      const { lat, lon } = await getGeolocation()

      const { data, error } = await supabase.functions.invoke('daily-outfits', {
        body: { lat, lon },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (error) {
        // El SDK solo da un mensaje genérico ("non-2xx status code"); el
        // cuerpo real de la respuesta (con el error de verdad) va en
        // error.context, que es el Response crudo de la función.
        let detail = error.message
        const ctx = (error as { context?: Response }).context
        if (ctx) {
          try {
            const body = await ctx.clone().json()
            if (body?.error) detail = body.error
          } catch {
            try {
              const text = await ctx.clone().text()
              if (text) detail = text
            } catch { /* usar mensaje generico */ }
          }
        }
        throw new Error(detail)
      }
      if (data?.error) throw new Error(data.error)

      return data.outfits as DailyOutfit[]
    },
    staleTime: 1000 * 60 * 60, // 1h — igualmente cambia de key al cambiar el día
    retry: false,
  })
}

/**
 * Puntúa (o quita la puntuación de) uno de los outfits diarios ya
 * generados. Se guarda en la propia fila de `daily_outfit_suggestions`
 * (columna `rating`) y `daily-outfits` la usa en el próximo día para
 * sesgar la generación hacia lo que gustó y evitar lo que no.
 */
export function useRateDailyOutfit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      date: string
      occasion: DailyOccasion
      rating: DailyOutfitRating | null
      /** Prendas concretas señaladas como "esta no combinaba" (solo aplica con rating negativo). */
      dislikedItemIds?: string[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')

      const { error } = await supabase
        .from('daily_outfit_suggestions')
        .update({
          rating: input.rating,
          disliked_item_ids: input.rating === 'negative' ? (input.dislikedItemIds ?? []) : [],
        })
        .eq('user_id', user.id)
        .eq('suggestion_date', input.date)
        .eq('occasion', input.occasion)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily-outfits'] }),
  })
}
