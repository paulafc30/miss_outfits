-- =====================================================================
-- Mi Armario - 0025: Rate limiting para las Edge Functions
-- =====================================================================
-- Tabla de contadores por usuario/endpoint/ventana temporal (ventanas fijas
-- de N segundos). Solo la tocan las Edge Functions via service_role (a
-- traves de la funcion check_rate_limit) - ni anon ni authenticated tienen
-- acceso directo.
-- =====================================================================

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  request_count int not null default 1,
  primary key (user_id, endpoint, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Incrementa el contador de la ventana actual y devuelve si la peticion
-- esta dentro del limite (true) o lo supera (false).
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests int,
  p_window_seconds int default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (user_id, endpoint, window_start, request_count)
  values (p_user_id, p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning request_count into v_count;

  -- limpieza oportunista de ventanas antiguas para que la tabla no crezca sin limite
  delete from public.rate_limits where window_start < now() - interval '1 hour';

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.check_rate_limit(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, int, int) to service_role;
