import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { deleteImage } from '@/lib/images'
import type { Clothe, ClothesStatus } from '@/types/database'

export function useClothes(statuses: ClothesStatus[]) {
  return useQuery({
    queryKey: ['clothes', statuses],
    queryFn: async (): Promise<Clothe[]> => {
      const { data, error } = await supabase
        .from('clothes')
        .select('*')
        .in('status', statuses)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateClothe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Clothe> & { user_id: string; name: string }) => {
      const { data, error } = await supabase.from('clothes').insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clothes'] }),
  })
}

export function useUpdateClothe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Clothe> & { id: string }) => {
      const { data, error } = await supabase.from('clothes').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clothes'] }),
  })
}

export function useDeleteClothe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clothe: Clothe) => {
      // Recoger todas las rutas en el bucket (cover + galería) y borrarlas
      const { data: imgs } = await supabase
        .from('clothe_images')
        .select('path')
        .eq('clothe_id', clothe.id)
      const paths = new Set<string>()
      if (clothe.image_path) paths.add(clothe.image_path)
      ;(imgs ?? []).forEach((r: { path: string | null }) => r.path && paths.add(r.path))
      for (const p of paths) await deleteImage(p)

      const { error } = await supabase.from('clothes').delete().eq('id', clothe.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clothes'] }),
  })
}

/**
 * Cambia el estado de una prenda y sincroniza los timestamps:
 *  - sold_at:  se rellena al pasar a 'vendida'; se limpia al volver a closet/baul/en_venta
 *  - listed_at: se rellena al pasar a 'en_venta'; se limpia al volver a closet/baul;
 *               se conserva al pasar a 'vendida' o 'archivada' (historial)
 *
 * Resiliencia: si las columnas opcionales (sold_at, listed_at) no existen
 * todavía en el esquema porque no se ejecutó la migración correspondiente,
 * reintenta enviando solo el `status` para que el cambio mínimo funcione.
 */
export function useChangeClothesStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ClothesStatus }) => {
      const now = new Date().toISOString()
      const fullPatch: Partial<Clothe> = { status }

      if (status === 'vendida') {
        fullPatch.sold_at = now
      } else if (status === 'en_venta') {
        fullPatch.listed_at = now
        fullPatch.sold_at = null
      } else if (status === 'baul' || status === 'closet') {
        fullPatch.sold_at = null
        fullPatch.listed_at = null
      }

      let result = await supabase.from('clothes').update(fullPatch).eq('id', id).select().single()

      // Si Supabase se queja porque alguna columna opcional no existe (migración
      // 0008_listed_at.sql aún no aplicada), reintentamos solo con status.
      const msg = (result.error?.message ?? '').toLowerCase()
      const missingColumn =
        result.error && (msg.includes('listed_at') || msg.includes('sold_at') || msg.includes('column'))
      if (missingColumn) {
        console.warn('Columna opcional inexistente en BD; reintentando sólo con status.', result.error)
        result = await supabase.from('clothes').update({ status }).eq('id', id).select().single()
      }

      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clothes'] }),
  })
}
