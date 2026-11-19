-- Unir dos cuentas del mismo cliente: todo lo de p_remove pasa a p_keep
-- (pedidos, pagos, movimientos de cuenta, devoluciones y resúmenes enviados),
-- se completan los datos que le falten a p_keep y se borra p_remove.

-- Los pedidos cerrados solo los cambia la administradora; al unir clientes
-- se permite cambiarles el cliente.
create or replace function public.guard_closed_orders() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status <> 'abierto' and not public.is_admin()
     and coalesce(current_setting('app.uniendo_clientes', true), '') <> 'si' then
    raise exception 'Solo la administradora puede modificar un pedido cerrado';
  end if;
  return new;
end $$;

create or replace function public.merge_customers(p_keep uuid, p_remove uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.customers;
begin
  -- Desde la app solo la administradora; desde el SQL Editor (sin usuario) también se permite.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo la administradora puede unir clientes';
  end if;
  if p_keep = p_remove then raise exception 'Elige dos clientes distintos'; end if;
  select * into r from public.customers where id = p_remove;
  if not found or not exists (select 1 from public.customers where id = p_keep) then
    raise exception 'Cliente no encontrado';
  end if;

  perform set_config('app.uniendo_clientes', 'si', true);
  update public.orders          set customer_id = p_keep where customer_id = p_remove;
  update public.payments        set customer_id = p_keep where customer_id = p_remove;
  update public.account_entries set customer_id = p_keep where customer_id = p_remove;
  update public.refunds         set customer_id = p_keep where customer_id = p_remove;
  delete from public.statement_sends s
   where s.customer_id = p_remove
     and exists (select 1 from public.statement_sends k where k.customer_id = p_keep and k.period = s.period);
  update public.statement_sends set customer_id = p_keep where customer_id = p_remove;
  perform set_config('app.uniendo_clientes', '', true);

  delete from public.customers where id = p_remove;
  update public.customers k
     set cedula  = coalesce(k.cedula, r.cedula),
         phone   = coalesce(k.phone, r.phone),
         email   = coalesce(k.email, r.email),
         notes   = nullif(concat_ws(' · ', k.notes, r.notes), ''),
         blocked = k.blocked or r.blocked
   where k.id = p_keep;
end $$;

revoke execute on function public.merge_customers(uuid, uuid) from public, anon;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;
