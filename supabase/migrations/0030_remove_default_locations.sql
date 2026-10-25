-- =====================================================================
-- Miss Outfits - 0030: Quitar las ubicaciones por defecto
-- =====================================================================
-- Una version previa de 0029 creo 4 ubicaciones por defecto en todas las
-- cuentas. Ahora las ubicaciones empiezan vacias y las anade cada usuaria.
-- Este script borra SOLO esas 4 (por nombre) y SOLO si ninguna prenda las
-- usa, asi que no pierde datos. Las cuentas de demo se rellenan en su propio
-- seeder (0027) y no se ven afectadas.
-- Ejecutar una sola vez (si 0029 ya estaba aplicada con los valores por
-- defecto); en instalaciones nuevas no hace nada.
-- =====================================================================

delete from public.locations l
 where l.name in ('Armario empotrado', 'Armario de la habitación', 'Cómoda', 'Casa de mis padres')
   and not exists (select 1 from public.clothes c where c.location_id = l.id)
   and not exists (
     select 1 from auth.users u where u.id = l.user_id and coalesce(u.is_anonymous, false)
   );
