import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatISODate } from '@/lib/calendar'
import type { Wear } from '@/types/database'

export interface WearWithRefs extends Wear {
  clothes: { id: string; name: string; image_url: string | null } | null
  outfits: { id: string; name: string; cover_image_url: string | null } | null
}

export function useWearsInRange(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ['wears', startISO, endISO],
    queryFn: async (): Promise<WearWithRefs[]> => {
      const { data, error } = await supabase
        .from('wears')
        .select('*, clothes(id, name, image_url), outfits(id, name, cover_image_url)')
        .gte('wear_date', startISO)
        .lte('wear_date', endISO)
        .order('wear_date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WearWithRefs[]
    },
  })
}

/** Wears que están planeados para HOY (recordatorio del día). */
export function useTodayPlannedWears() {
  const today = formatISODate(new Date())
  return useQuery({
    queryKey: ['wears', 'today-planned', today],
    queryFn: async (): Promise<WearWithRefs[]> => {
      const { data, error } = await supabase
        .from('wears')
        .select('*, clothes(id, name, image_url), outfits(id, name, cover_image_url)')
        .eq('wear_date', today)
        .eq('planned', true)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WearWithRefs[]
    },
    // Refrescar al volver a la pestaña — útil si pasa medianoche
    refetchOnWindowFocus: true,
  })
}

/**
 * Usos de una prenda: cuántas veces se ha llevado (wears ya hechos, no
 * planeados) contando tanto los registros directos de la prenda como los de
 * los outfits que la incluyen, y la fecha del último.
 */
export function useClotheWearStats(clotheId: string | undefined) {
  return useQuery({
    queryKey: ['wears', 'clothe-stats', clotheId],
    enabled: !!clotheId,
    queryFn: async (): Promise<{ count: number; lastDate: string | null }> => {
      const dates: string[] = []

      const { data: direct, error: e1 } = await supabase
        .from('wears')
        .select('wear_date')
        .eq('clothe_id', clotheId!)
        .eq('planned', false)
      if (e1) throw e1
      for (const w of direct ?? []) dates.push(w.wear_date)

      const { data: items, error: e2 } = await supabase
        .from('outfit_items')
        .select('outfit_id')
        .eq('clothe_id', clotheId!)
      if (e2) throw e2
      const outfitIds = [...new Set((items ?? []).map((i) => i.outfit_id))]
      if (outfitIds.length > 0) {
        const { data: viaOutfit, error: e3 } = await supabase
          .from('wears')
          .select('wear_date')
          .in('outfit_id', outfitIds)
          .eq('planned', false)
        if (e3) throw e3
        for (const w of viaOutfit ?? []) dates.push(w.wear_date)
      }

      dates.sort()
      return { count: dates.length, lastDate: dates.length ? dates[dates.length - 1] : null }
    },
  })
}

export function useCreateWear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      user_id: string
      wear_date: string
      clothe_id?: string | null
      outfit_id?: string | null
      notes?: string | null
      planned?: boolean
    }) => {
      // Por defecto: planeado si la fecha es hoy o futura, histórico si es pasada
      const auto = input.wear_date >= formatISODate(new Date())
      const { data, error } = await supabase
        .from('wears')
        .insert({
          user_id: input.user_id,
          wear_date: input.wear_date,
          clothe_id: input.clothe_id ?? null,
          outfit_id: input.outfit_id ?? null,
          notes: input.notes ?? null,
          planned: input.planned ?? auto,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wears'] }),
  })
}

export function useUpdateWear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Wear> & { id: string }) => {
      const { data, error } = await supabase
        .from('wears')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wears'] }),
  })
}

export function useDeleteWear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wears').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wears'] }),
  })
}
