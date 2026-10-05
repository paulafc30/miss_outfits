// PAUSADO: Pinterest denegó el permiso de la API (oct-2026). Hook sin uso activo mientras
// PINTEREST_ENABLED sea false en pages/Inspiracion.tsx. No borrar: se retomará si lo aprueban.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const PINTEREST_API = 'https://api.pinterest.com/v5'

export interface PinterestBoard {
  id: string
  name: string
  description: string
  privacy: string
  media?: { image_cover_url?: string; pin_thumbnail_urls?: string[] }
  pin_count: number
}

export interface PinterestPin {
  id: string
  title?: string
  description?: string
  link?: string
  media?: { images?: { '600x'?: { url: string }; '236x'?: { url: string } } }
}

// --- Token helpers ---

export function usePinterestToken() {
  return useQuery({
    queryKey: ['pinterest-token'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('pinterest_access_token, pinterest_token_expires_at')
        .eq('id', user.id)
        .single()
      if (!data?.pinterest_access_token) return null
      // Considerar expirado si quedan menos de 60 seg
      if (data.pinterest_token_expires_at) {
        const expiresAt = new Date(data.pinterest_token_expires_at).getTime()
        if (expiresAt - Date.now() < 60_000) return null
      }
      return data.pinterest_access_token as string
    },
    staleTime: 60_000,
  })
}

export function useDisconnectPinterest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({
        pinterest_access_token: null,
        pinterest_refresh_token: null,
        pinterest_token_expires_at: null,
      }).eq('id', user.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pinterest-token'] }),
  })
}

export function buildPinterestOAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'boards:read,pins:read,user_accounts:read',
    state: crypto.randomUUID(),
  })
  return `https://www.pinterest.com/oauth/?${params.toString()}`
}

// --- Data hooks (usan el token del usuario directamente) ---

export function usePinterestBoards(token: string | null | undefined) {
  return useQuery({
    queryKey: ['pinterest-boards', token],
    enabled: !!token,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch(`${PINTEREST_API}/boards?page_size=25`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error fetching boards')
      const json = await res.json()
      return (json.items ?? []) as PinterestBoard[]
    },
  })
}

export function usePinterestPins(token: string | null | undefined, boardId: string | null) {
  return useQuery({
    queryKey: ['pinterest-pins', boardId, token],
    enabled: !!token && !!boardId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const fields = 'id,title,description,link,media'
      const res = await fetch(`${PINTEREST_API}/boards/${boardId}/pins?page_size=50&fields=${fields}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error fetching pins')
      const json = await res.json()
      return (json.items ?? []) as PinterestPin[]
    },
  })
}
