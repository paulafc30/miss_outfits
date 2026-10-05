-- PAUSADO: integración con Pinterest en pausa (permiso de API denegado). Columnas conservadas, sin uso activo.
-- Almacena tokens de Pinterest por usuario.
-- El access_token se usa para llamar a la API de Pinterest en nombre del usuario.
alter table public.profiles
  add column if not exists pinterest_access_token  text,
  add column if not exists pinterest_refresh_token text,
  add column if not exists pinterest_token_expires_at timestamptz;
