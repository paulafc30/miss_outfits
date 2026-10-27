import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Season } from '@/types/database'

export function useSeasons() {
  return useQuery<Season[]>({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Devuelve un map { clothe_id -> season_id[] } para todas las prendas del usuario */
export function useClotheSeasons() {
  return useQuery<Record<string, string[]>>({
    queryKey: ['clothe_seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clothe_seasons')
        .select('clothe_id, season_id')
      if (error) throw error
      const map: Record<string, string[]> = {}
      for (const row of data ?? []) {
        if (!map[row.clothe_id]) map[row.clothe_id] = []
        map[row.clothe_id].push(row.season_id)
      }
      return map
    },
  })
}

/** Devuelve los season_ids de una prenda concreta */
export function useClotheSeasonIds(clotheId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['clothe_seasons', clotheId],
    enabled: !!clotheId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clothe_seasons')
        .select('season_id')
        .eq('clothe_id', clotheId!)
      if (error) throw error
      return (data ?? []).map((r) => r.season_id)
    },
  })
}

/** Reemplaza las temporadas de una prenda por las seleccionadas */
export function useSetClotheSeasons() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clotheId, seasonIds }: { clotheId: string; seasonIds: string[] }) => {
      // Borrar todas las temporadas actuales de esta prenda
      const { error: delError } = await supabase
        .from('clothe_seasons')
        .delete()
        .eq('clothe_id', clotheId)
      if (delError) throw delError

      // Insertar las nuevas (si hay alguna)
      if (seasonIds.length > 0) {
        const rows = seasonIds.map((season_id) => ({ clothe_id: clotheId, season_id }))
        const { error: insError } = await supabase.from('clothe_seasons').insert(rows)
        if (insError) throw insError
      }
    },
    onSuccess: (_data, { clotheId }) => {
      qc.invalidateQueries({ queryKey: ['clothe_seasons'] })
      qc.invalidateQueries({ queryKey: ['clothe_seasons', clotheId] })
    },
  })
}

export function useCreateSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, icon, color }: { name: string; icon: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa')
      const { data, error } = await supabase
        .from('seasons')
        .insert({ user_id: user.id, name, icon, color, is_global: false })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
  })
}

export function useDeleteSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasons').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
      qc.invalidateQueries({ queryKey: ['clothe_seasons'] })
    },
  })
}
