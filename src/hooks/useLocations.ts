import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Location } from '@/types/database'

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async (): Promise<Location[]> => {
      const { data, error } = await supabase.from('locations').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { user_id: string; name: string }): Promise<Location> => {
      const { data, error } = await supabase.from('locations').insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })
}

export function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('locations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] })
      // las prendas que estaban en esa ubicacion pasan a "sin ubicacion"
      qc.invalidateQueries({ queryKey: ['clothes'] })
    },
  })
}
