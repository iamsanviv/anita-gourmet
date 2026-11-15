-- El personal no puede actualizar compras (solo leer e insertar), así que el total
-- se calcula antes de insertar la compra en vez de actualizarlo al final.
create or replace function public.register_purchase(
  p_supplier_id uuid, p_date date, p_method text, p_items jsonb, p_note text
) returns public.purchases
language plpgsql security invoker set search_path = public as $$
declare p public.purchases; i jsonb; v_total int;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'La compra está vacía'; end if;
  select coalesce(sum(round((x->>'quantity')::numeric * (x->>'unit_cost')::numeric)), 0)::int into v_total
    from jsonb_array_elements(p_items) x;
  insert into public.purchases (supplier_id, purchased_on, method, note, total)
    values (p_supplier_id, coalesce(p_date, (now() at time zone 'America/Bogota')::date), p_method, nullif(trim(p_note), ''), v_total)
    returning * into p;
  for i in select * from jsonb_array_elements(p_items) loop
    if (i->>'quantity')::numeric <= 0 then raise exception 'Cantidad inválida'; end if;
    insert into public.purchase_items (purchase_id, item_id, quantity, unit_cost, total)
      values (p.id, (i->>'item_id')::uuid, (i->>'quantity')::numeric, (i->>'unit_cost')::numeric,
              round((i->>'quantity')::numeric * (i->>'unit_cost')::numeric));
    insert into public.stock_movements (item_id, kind, quantity, purchase_id, note)
      values ((i->>'item_id')::uuid, 'compra', (i->>'quantity')::numeric, p.id, 'Compra');
    update public.inventory_items set unit_cost = (i->>'unit_cost')::numeric
     where id = (i->>'item_id')::uuid and (i->>'unit_cost')::numeric > 0;
  end loop;
  return p;
end $$;
