-- =====================================================================
-- Miss Outfits - 0026: Revision de GRANTs (cambio de Supabase del 30-oct-2026)
-- =====================================================================
-- A partir del 30 de octubre de 2026 las tablas nuevas de "public" ya no
-- se exponen solas al Data API: hace falta GRANT explicito. Tras auditar
-- las migraciones 0001-0025 quedaban estos cabos sueltos:
--
--  1. stylist_feedback (0019) no tenia ningun GRANT. El cliente inserta
--     en ella (StylistChat) y la Edge Function chat-stylist la lee con
--     service_role.
--  2. seasons (0016), clothe_seasons (0017) y feedback (0020) no daban
--     permisos a service_role (las Edge Functions lo usan).
--  3. clothes (0015) tenia GRANT ALL a anon y authenticated, incluyendo
--     TRUNCATE/REFERENCES/TRIGGER. RLS no limita TRUNCATE, asi que se
--     recorta a lo que la app necesita (minimo privilegio).
--
-- Idempotente: se puede ejecutar varias veces y salta tablas que no existan.
-- No cambia ningun dato ni politica RLS.
-- =====================================================================

do $$
begin
  -- 1. stylist_feedback: patron estandar de la app
  if to_regclass('public.stylist_feedback') is not null then
    grant select                          on public.stylist_feedback to anon;
    grant select, insert, update, delete  on public.stylist_feedback to authenticated;
    grant all                             on public.stylist_feedback to service_role;
  end if;

  -- 2. service_role en tablas que solo lo tenian a medias
  if to_regclass('public.seasons') is not null then
    grant all on public.seasons to service_role;
  end if;
  if to_regclass('public.clothe_seasons') is not null then
    grant all on public.clothe_seasons to service_role;
  end if;
  if to_regclass('public.feedback') is not null then
    grant all on public.feedback to service_role;
  end if;

  -- 3. clothes: quitar privilegios que la app no usa
  if to_regclass('public.clothes') is not null then
    revoke insert, update, delete, truncate, references, trigger on public.clothes from anon;
    revoke truncate, references, trigger on public.clothes from authenticated;
    grant select                         on public.clothes to anon;
    grant select, insert, update, delete on public.clothes to authenticated;
    grant all                            on public.clothes to service_role;
  end if;
end $$;
