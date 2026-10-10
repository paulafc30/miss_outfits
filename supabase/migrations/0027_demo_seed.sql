-- =====================================================================
-- Miss Outfits - 0027: Modo demo (sesiones anonimas + seeder)
-- =====================================================================
-- El boton "Ver demo" del login crea una sesion anonima de Supabase Auth
-- (signInAnonymously) y llama a seed_demo_data() para rellenar esa cuenta
-- con prendas, outfits, calendario y deseos de ejemplo. Cada visitante
-- tiene su propio espacio, asi que nadie pisa los datos de otro.
--
-- Requisitos fuera de este SQL (Dashboard de Supabase):
--   * Authentication -> Sign In / Providers -> activar "Allow anonymous sign-ins".
--   * Recomendado: activar CAPTCHA (Authentication -> Attack Protection).
--   * Opcional: activar la extension pg_cron para la limpieza automatica
--     (ver bloque final); si no, puedes ejecutar cleanup_demo_users() a mano.
--
-- Las imagenes de ejemplo son SVG en public/demo/ (se sirven desde el propio
-- dominio, no hace falta subir nada a Storage).
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

create or replace function public.is_anonymous_session()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids jsonb := '{}'::jsonb;   -- slug -> id de prenda
  v_cat jsonb := '{}'::jsonb;   -- nombre de categoria -> id
  v_cid uuid;
  v_oid uuid;
  v_wid uuid;
  v_item jsonb;
  v_slug text;
  v_season int;
  v_outfit record;
  v_clothe_slug text;
  v_colors text[];
  v_hexes text[];
begin
  if v_uid is null or not public.is_anonymous_session() then
    raise exception 'seed_demo_data solo se puede ejecutar desde una sesion de demo';
  end if;

  -- Idempotente: si ya hay prendas, no se vuelve a sembrar
  if exists (select 1 from public.clothes where user_id = v_uid) then
    return;
  end if;

  update public.profiles
     set username = 'Demo', height_cm = 168, bust_cm = 90, waist_cm = 70, hips_cm = 96,
         top_size = 'M', bottom_size = 'M', shoe_size = '38'
   where id = v_uid;

  -- Categorias (las crea el trigger de alta; por si acaso, se aseguran)
  insert into public.categories (user_id, name, color)
  select v_uid, c.name, c.color
    from (values ('Camisetas','#a855f7'),('Pantalones','#3b82f6'),('Vestidos','#ec4899'),
                 ('Zapatos','#f59e0b'),('Accesorios','#10b981'),('Abrigos','#6366f1'),('Deporte','#14b8a6')) as c(name, color)
  on conflict (user_id, name) do nothing;

  select coalesce(jsonb_object_agg(name, id), '{}'::jsonb) into v_cat
    from public.categories where user_id = v_uid;

  -- ---------------------------------------------------------------
  -- Prendas: slug, nombre, categoria, marca, talla, estado, precio, colores, temporadas (1=prim 2=ver 3=oto 4=inv)
  -- ---------------------------------------------------------------
  for v_item in select * from jsonb_array_elements($j$[
    {"slug":"camiseta-blanca","name":"Camiseta básica blanca","cat":"Camisetas","brand":"Nord & Co.","size":"M","status":"closet","colors":["Blanco"],"hexes":["#ffffff"],"seasons":[1,2],"tags":["básico","algodón"],"material":"Algodón"},
    {"slug":"camiseta-rosa","name":"Camiseta rosa palo","cat":"Camisetas","brand":"Maison Lila","size":"S","status":"closet","colors":["Rosa"],"hexes":["#ec6a9c"],"seasons":[1,2],"tags":["verano"],"material":"Algodón"},
    {"slug":"top-azul-marino","name":"Top azul marino","cat":"Camisetas","brand":"Nord & Co.","size":"M","status":"closet","colors":["Azul marino"],"hexes":["#1e3a8a"],"seasons":[1,2,3],"tags":["elegante"],"material":"Viscosa"},
    {"slug":"blusa-beige","name":"Blusa fluida beige","cat":"Camisetas","brand":"Maison Lila","size":"M","status":"closet","colors":["Beige"],"hexes":["#e8d5b7"],"seasons":[1,3],"tags":["oficina"],"material":"Viscosa"},
    {"slug":"vaqueros","name":"Vaqueros rectos","cat":"Pantalones","brand":"Denim Studio","size":"38","status":"closet","colors":["Azul"],"hexes":["#3b6fc4"],"seasons":[1,3,4],"tags":["básico"],"material":"Algodón"},
    {"slug":"pantalon-negro","name":"Pantalón negro de vestir","cat":"Pantalones","brand":"Nord & Co.","size":"38","status":"closet","colors":["Negro"],"hexes":["#222222"],"seasons":[1,3,4],"tags":["oficina","elegante"],"material":"Poliéster"},
    {"slug":"vestido-rojo","name":"Vestido rojo midi","cat":"Vestidos","brand":"Maison Lila","size":"M","status":"closet","colors":["Rojo"],"hexes":["#dc2626"],"seasons":[2,3],"tags":["fiesta","cena"],"material":"Crepé"},
    {"slug":"vestido-floral","name":"Vestido flores de verano","cat":"Vestidos","brand":"Atelier Sol","size":"M","status":"closet","colors":["Rosa"],"hexes":["#f08bb0"],"seasons":[1,2],"tags":["verano","casual"],"material":"Algodón"},
    {"slug":"zapatillas-blancas","name":"Zapatillas blancas","cat":"Zapatos","brand":"Stride","size":"38","status":"closet","colors":["Blanco"],"hexes":["#f3f3f3"],"seasons":[1,2,3],"tags":["diario"],"material":"Piel sintética"},
    {"slug":"botas-marron","name":"Botas marrón","cat":"Zapatos","brand":"Stride","size":"38","status":"closet","colors":["Marrón"],"hexes":["#8b5e3c"],"seasons":[3,4],"tags":["invierno"],"material":"Piel"},
    {"slug":"bolso-beige","name":"Bolso bandolera beige","cat":"Accesorios","brand":"Atelier Sol","size":null,"status":"closet","colors":["Beige"],"hexes":["#d9c4a0"],"seasons":[1,2,3,4],"tags":["diario"],"material":"Piel sintética"},
    {"slug":"abrigo-camel","name":"Abrigo camel","cat":"Abrigos","brand":"Nord & Co.","size":"M","status":"closet","colors":["Marrón"],"hexes":["#c19a6b"],"seasons":[3,4],"tags":["invierno","elegante"],"material":"Lana"},
    {"slug":"chaqueta-negra","name":"Chaqueta negra","cat":"Abrigos","brand":"Denim Studio","size":"M","status":"closet","colors":["Negro"],"hexes":["#262626"],"seasons":[1,3],"tags":["básico"],"material":"Poliéster"},
    {"slug":"top-deportivo","name":"Top deportivo negro","cat":"Deporte","brand":"Stride","size":"M","status":"closet","colors":["Negro"],"hexes":["#1f2937"],"seasons":[1,2,3,4],"tags":["gym","deporte"],"material":"Poliéster"},
    {"slug":"leggings-deportivos","name":"Leggings deportivos grises","cat":"Deporte","brand":"Stride","size":"M","status":"closet","colors":["Gris"],"hexes":["#6b7280"],"seasons":[1,2,3,4],"tags":["gym","deporte"],"material":"Poliéster"},
    {"slug":"camiseta-amarilla","name":"Camiseta amarilla","cat":"Camisetas","brand":"Maison Lila","size":"M","status":"baul","colors":["Amarillo"],"hexes":["#fbbf24"],"seasons":[2],"tags":["verano"],"material":"Algodón"},
    {"slug":"pantalon-morado","name":"Pantalón palazzo morado","cat":"Pantalones","brand":"Atelier Sol","size":"38","status":"baul","colors":["Morado"],"hexes":["#7c3aed"],"seasons":[1,2],"tags":["fiesta"],"material":"Viscosa"},
    {"slug":"vestido-marino","name":"Vestido azul marino","cat":"Vestidos","brand":"Maison Lila","size":"M","status":"en_venta","price":18,"vinted":true,"wallapop":false,"colors":["Azul marino"],"hexes":["#1e3a8a"],"seasons":[1,2,3],"tags":["cena"],"material":"Crepé","listed_days":6},
    {"slug":"bolso-negro","name":"Bolso negro pequeño","cat":"Accesorios","brand":"Atelier Sol","size":null,"status":"en_venta","price":12,"vinted":false,"wallapop":true,"colors":["Negro"],"hexes":["#2a2a2a"],"seasons":[1,2,3,4],"tags":["fiesta"],"material":"Piel sintética","listed_days":15},
    {"slug":"zapatillas-azules","name":"Zapatillas azules","cat":"Zapatos","brand":"Stride","size":"38","status":"vendida","price":25,"vinted":true,"wallapop":false,"colors":["Azul"],"hexes":["#4f7fd6"],"seasons":[1,2,3],"tags":["diario"],"material":"Textil","listed_days":30,"sold_days":9}
  ]$j$::jsonb)
  loop
    v_slug := v_item ->> 'slug';
    select array(select jsonb_array_elements_text(v_item -> 'colors')) into v_colors;
    select array(select jsonb_array_elements_text(v_item -> 'hexes')) into v_hexes;

    insert into public.clothes (
      user_id, name, category_id, image_url, tags, status, brand, size, material,
      colors, color_hexes, price, on_vinted, on_wallapop, listed_at, sold_at, notes
    ) values (
      v_uid,
      v_item ->> 'name',
      (v_cat ->> (v_item ->> 'cat'))::uuid,
      '/demo/' || v_slug || '.svg',
      array(select jsonb_array_elements_text(v_item -> 'tags')),
      v_item ->> 'status',
      v_item ->> 'brand',
      v_item ->> 'size',
      v_item ->> 'material',
      v_colors,
      v_hexes,
      (v_item ->> 'price')::numeric,
      coalesce((v_item ->> 'vinted')::boolean, false),
      coalesce((v_item ->> 'wallapop')::boolean, false),
      case when v_item ? 'listed_days' then now() - ((v_item ->> 'listed_days')::int || ' days')::interval end,
      case when v_item ? 'sold_days'   then now() - ((v_item ->> 'sold_days')::int   || ' days')::interval end,
      case when v_item ->> 'status' = 'closet' then 'Prenda de ejemplo del modo demo.' end
    ) returning id into v_cid;

    v_ids := v_ids || jsonb_build_object(v_slug, v_cid);

    for v_season in select jsonb_array_elements_text(v_item -> 'seasons')::int loop
      insert into public.clothe_seasons (clothe_id, season_id)
      values (v_cid, ('00000000-0000-0000-0000-00000000000' || v_season)::uuid)
      on conflict do nothing;
    end loop;
  end loop;

  -- ---------------------------------------------------------------
  -- Outfits
  -- ---------------------------------------------------------------
  for v_outfit in select * from jsonb_to_recordset($j$[
    {"name":"Casual de diario","items":["camiseta-blanca","vaqueros","zapatillas-blancas","bolso-beige"]},
    {"name":"Oficina","items":["blusa-beige","pantalon-negro","chaqueta-negra","bolso-beige"]},
    {"name":"Cena especial","items":["vestido-rojo","botas-marron","abrigo-camel"]},
    {"name":"Paseo de verano","items":["vestido-floral","zapatillas-blancas","bolso-beige"]}
  ]$j$::jsonb) as x(name text, items jsonb)
  loop
    insert into public.outfits (user_id, name) values (v_uid, v_outfit.name) returning id into v_oid;
    for v_clothe_slug in select jsonb_array_elements_text(v_outfit.items) loop
      insert into public.outfit_items (outfit_id, clothe_id)
      values (v_oid, (v_ids ->> v_clothe_slug)::uuid)
      on conflict do nothing;
    end loop;

    -- Calendario: cada outfit se "llevo" en fechas distintas + 1 planificado a futuro
    if v_outfit.name = 'Casual de diario' then
      insert into public.wears (user_id, outfit_id, wear_date, planned) values
        (v_uid, v_oid, current_date - 1, false), (v_uid, v_oid, current_date - 6, false),
        (v_uid, v_oid, current_date + 2, true);
    elsif v_outfit.name = 'Oficina' then
      insert into public.wears (user_id, outfit_id, wear_date, planned) values
        (v_uid, v_oid, current_date - 2, false), (v_uid, v_oid, current_date - 3, false),
        (v_uid, v_oid, current_date - 9, false);
    elsif v_outfit.name = 'Cena especial' then
      insert into public.wears (user_id, outfit_id, wear_date, planned, notes) values
        (v_uid, v_oid, current_date - 4, false, 'Cena de cumpleaños'),
        (v_uid, v_oid, current_date + 5, true, 'Cena con amigas');
    else
      insert into public.wears (user_id, outfit_id, wear_date, planned) values
        (v_uid, v_oid, current_date - 12, false);
    end if;
  end loop;

  -- Algunas prendas sueltas en el calendario
  insert into public.wears (user_id, clothe_id, wear_date, planned) values
    (v_uid, (v_ids ->> 'top-azul-marino')::uuid, current_date - 5, false),
    (v_uid, (v_ids ->> 'vaqueros')::uuid,        current_date - 7, false),
    (v_uid, (v_ids ->> 'camiseta-rosa')::uuid,   current_date - 8, false);

  -- ---------------------------------------------------------------
  -- Lista de deseos (la lista "Mis deseos" la crea el trigger de alta)
  -- ---------------------------------------------------------------
  insert into public.wishlists (user_id, name) values (v_uid, 'Mis deseos') on conflict (user_id, name) do nothing;
  insert into public.wishlists (user_id, name, color) values (v_uid, 'Rebajas de invierno', '#6366f1')
    on conflict (user_id, name) do nothing;

  select id into v_wid from public.wishlists where user_id = v_uid and name = 'Mis deseos';
  insert into public.wishlist (user_id, wishlist_id, url, name, price, image_url, notes) values
    (v_uid, v_wid, 'https://example.com/chaqueta-verde', 'Chaqueta verde oversize', 59.90, '/demo/deseo-chaqueta-verde.svg', 'Para la entretiempo'),
    (v_uid, v_wid, 'https://example.com/vestido-verano', 'Vestido amarillo de verano', 34.95, '/demo/deseo-vestido-verano.svg', null);

  select id into v_wid from public.wishlists where user_id = v_uid and name = 'Rebajas de invierno';
  insert into public.wishlist (user_id, wishlist_id, url, name, price, image_url, notes) values
    (v_uid, v_wid, 'https://example.com/botas-negras', 'Botas negras de tacón bajo', 79.00, '/demo/deseo-botas-negras.svg', null),
    (v_uid, v_wid, 'https://example.com/bolso-rojo', 'Bolso rojo', 45.00, '/demo/deseo-bolso-rojo.svg', 'Esperar a las rebajas');

  -- ---------------------------------------------------------------
  -- Inspiracion (enlaces a tiendas de ejemplo)
  -- ---------------------------------------------------------------
  insert into public.inspirations (user_id, kind, title, url, image_url, position) values
    (v_uid, 'store', 'Tienda de ejemplo: básicos', 'https://example.com/basicos', null, 0),
    (v_uid, 'store', 'Tienda de ejemplo: abrigos', 'https://example.com/abrigos', null, 1);
end;
$$;

revoke all on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;

-- ---------------------------------------------------------------------
-- Limpieza: borra las cuentas de demo antiguas (y, por ON DELETE CASCADE,
-- todos sus datos). Los archivos que alguien suba a Storage desde una demo
-- no se borran con esto.
-- ---------------------------------------------------------------------
create or replace function public.cleanup_demo_users(p_older_than interval default interval '3 days')
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete from auth.users
     where is_anonymous = true
       and created_at < now() - p_older_than
    returning 1
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

revoke all on function public.cleanup_demo_users(interval) from public, anon, authenticated;
grant execute on function public.cleanup_demo_users(interval) to service_role;

-- Programacion diaria SOLO si la extension pg_cron esta activada
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cleanup-demo-users', '17 3 * * *', 'select public.cleanup_demo_users()');
  else
    raise notice 'pg_cron no esta activado: ejecuta select public.cleanup_demo_users(); a mano de vez en cuando.';
  end if;
end;
$$;
