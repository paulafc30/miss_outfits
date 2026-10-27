import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export type SuggestedOccasion = 'casual' | 'trabajo' | 'cena' | 'gym' | 'evento'

export interface OutfitItem {
  id: string
  name: string
  brand: string | null
  colors: string[]
  image_url: string | null
}

export interface SuggestedOutfit {
  name: string
  reason: string
  items: OutfitItem[]
  weather: string
}

export function useOutfitSuggestion() {
  const [loading, setLoading] = useState(false)
  const [outfits, setOutfits] = useState<SuggestedOutfit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const suggest = async (occasion: SuggestedOccasion) => {
    setLoading(true)
    setOutfits(null)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')

      // Geoloc opcional
      let lat: number | null = null
      let lon: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch {
        // continuar sin clima
      }

      const { data, error: fnError } = await supabase.functions.invoke('suggest-outfit', {
        body: { occasion, lat, lon },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      setOutfits(data.outfits)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setOutfits(null); setError(null) }

  return { suggest, loading, outfits, error, reset }
}
