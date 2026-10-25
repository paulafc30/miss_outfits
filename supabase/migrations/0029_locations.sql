-- =====================================================================
-- Miss Outfits - 0029: Ubicaciones de las prendas
-- =====================================================================
-- Cada prenda puede tener una ubicacion ("Armario empotrado", "Armario de
-- la habitacion", "Casa de mis padres"...). Las ubicaciones son por usuaria
-- y editables; al crear un perfil se generan unas por defecto.
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

-- Ubicaciones por defecto al crear un perfil (mismo patron que las categorias)
create or replace function public.create_default_locations()
returns trigger as $$
begin
  insert into public.locations (user_id, name) values
    (new.id, 'Armario empotrado'),
    (new.id, 'Armario de la habitación'),
    (new.id, 'Cómoda'),
    (new.id, 'Casa de mis padres')
  on conflict (user_id, name) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_create_default_locations on public.profiles;
create trigger profiles_create_default_locations
  after insert on public.profiles
  for each row execute procedure public.create_default_locations();

-- Cuentas ya existentes: se les crean las mismas ubicaciones por defecto
insert into public.locations (user_id, name)
select p.id, l.name
  from public.profiles p
  cross join (values ('Armario empotrado'), ('Armario de la habitación'), ('Cómoda'), ('Casa de mis padres')) as l(name)
on conflict (user_id, name) do nothing;
