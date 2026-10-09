import { supabase, STORAGE_BUCKET } from './supabase'

/** Sube un File al bucket clothes-images bajo <user_id>/<uuid>-<name> y devuelve la URL pública y el path. */
export async function uploadImage(file: File, userId: string): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${userId}/${fileName}`

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Borra un objeto del bucket si existe. */
export async function deleteImage(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(STORAGE_BUCKET).remove([path])
}

const AVATARS_BUCKET = 'avatars'

/** Sube una foto de perfil al bucket 'avatars' bajo <user_id>/<uuid>. */
export async function uploadAvatar(file: File, userId: string): Promise<{ url: string; path: string }> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${userId}/${fileName}`

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    // Mensaje claro si todavía no se ha ejecutado la migración 0006_avatars
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('not found') || msg.includes('bucket') || (error as { statusCode?: string }).statusCode === '404') {
      throw new Error(
        'El bucket "avatars" no existe todavía en Supabase. Ejecuta la migración ' +
        '"0006_avatars.sql" en el SQL Editor para crearlo.'
      )
    }
    throw error
  }

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Borra una foto de perfil del bucket 'avatars'. */
export async function deleteAvatar(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(AVATARS_BUCKET).remove([path])
}
