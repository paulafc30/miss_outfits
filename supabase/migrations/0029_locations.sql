-- =====================================================================
-- Miss Outfits - 0029: Ubicaciones de las prendas
-- =====================================================================
-- Cada prenda puede tener una ubicacion ("Armario empotrado", "Armario de
-- la habitacion", "Casa de mis padres"...). Las ubicaciones son por usuaria
-- y las crea ella misma (empiezan vacias).
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

create table if not exists public.locations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

alter table public.locations enable row level security;

drop policy if exists "locations all own" on public.locations;
create policy "locations all own" on public.locations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select                         on public.locations to anon;
grant select, insert, update, delete on public.locations to authenticated;
grant all                            on public.locations to service_role;

alter table public.clothes
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists clothes_location_id_idx on public.clothes (location_id);

-- No se crean ubicaciones por defecto: cada usuaria anade las suyas desde el
-- formulario de la prenda. Si una version anterior de esta migracion creo un
-- trigger con valores por defecto, se elimina aqui.
drop trigger if exists profiles_create_default_locations on public.profiles;
drop function if exists public.create_default_locations();
