-- =====================================================================
-- Miss Outfits - 0031: Precio de compra de las prendas
-- =====================================================================
-- Campo opcional con lo que costo la prenda. Junto al precio de venta
-- (`price`) permite calcular el margen en las estadisticas de Venta.
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

alter table public.clothes
  add column if not exists purchase_price numeric(10, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clothes_purchase_price_nonneg'
  ) then
    alter table public.clothes
      add constraint clothes_purchase_price_nonneg check (purchase_price is null or purchase_price >= 0);
  end if;
end $$;
