-- Anita Gourmet · Fase 2: inventario, recetas, compras, proveedores, devoluciones,
-- cierre de caja, menú del día y resúmenes mensuales.
-- Cantidades de inventario en la unidad de cada ítem (und, g, kg, ml, L, loncha).

-- ---------- Proveedores ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Ítems de inventario ----------
-- ingrediente: se usa en recetas · producto: se compra hecho y se vende tal cual
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'ingrediente' check (kind in ('ingrediente', 'producto')),
  unit text not null default 'und' check (unit in ('und', 'g', 'kg', 'ml', 'L', 'loncha')),
  stock numeric not null default 0,
  min_stock numeric not null default 0 check (min_stock >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0), -- costo de una unidad (último precio de compra)
  icon text not null default '📦',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Receta: cuánto de cada ítem gasta una unidad del producto
create table public.recipes (
  product_id uuid not null references public.products (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  quantity numeric not null check (quantity > 0),
  primary key (product_id, item_id)
);

-- ---------- Compras ----------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id),
  purchased_on date not null default (now() at time zone 'America/Bogota')::date,
  method text check (method in ('efectivo', 'nequi', 'breb', 'credito')),
  total int not null default 0 check (total >= 0),
  note text,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  total int not null check (total >= 0)
);

-- ---------- Movimientos de inventario ----------
-- quantity con signo: + entra (compra, anulación, ajuste), − sale (venta, merma, ajuste)
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id),
  kind text not null check (kind in ('compra', 'venta', 'merma', 'ajuste', 'anulacion')),
  quantity numeric not null,
  order_id uuid references public.orders (id),
  purchase_id uuid references public.purchases (id),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (item_id, created_at desc);
create index on public.stock_movements (order_id);

create or replace function public.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.inventory_items set stock = stock + new.quantity where id = new.item_id;
  return new;
end $$;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Costo de una unidad del producto según su receta (null si no tiene receta)
create or replace function public.product_cost(p_product_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select sum(r.quantity * i.unit_cost)
    from public.recipes r join public.inventory_items i on i.id = r.item_id
   where r.product_id = p_product_id;
$$;

-- Costo guardado en cada línea vendida, para calcular la ganancia
alter table public.order_items add column unit_cost int;

-- Al cobrar: guarda el costo y descuenta la receta del inventario.
-- Al anular un pedido cobrado: devuelve al inventario lo que se había descontado.
create or replace function public.stock_on_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'abierto' and new.status = 'cobrado' then
    update public.order_items oi
       set unit_cost = round(public.product_cost(oi.product_id))
     where oi.order_id = new.id and oi.product_id is not null;
    insert into public.stock_movements (item_id, kind, quantity, order_id, note)
      select r.item_id, 'venta', -sum(r.quantity * oi.quantity), new.id, 'Pedido #' || new.number
        from public.order_items oi join public.recipes r on r.product_id = oi.product_id
       where oi.order_id = new.id
       group by r.item_id;
  elsif old.status = 'cobrado' and new.status = 'anulado' then
    insert into public.stock_movements (item_id, kind, quantity, order_id, note)
      select m.item_id, 'anulacion', -sum(m.quantity), new.id, 'Anulación pedido #' || new.number
        from public.stock_movements m
       where m.order_id = new.id and m.kind = 'venta'
       group by m.item_id;
  end if;
  return new;
end $$;
create trigger orders_stock after update of status on public.orders
  for each row execute function public.stock_on_order_status();

-- ---------- Registrar compra ----------
-- p_items: [{item_id, quantity, unit_cost}] · unit_cost = precio de una unidad
create or replace function public.register_purchase(
  p_supplier_id uuid, p_date date, p_method text, p_items jsonb, p_note text
) returns public.purchases
language plpgsql security invoker set search_path = public as $$
declare p public.purchases; i jsonb;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'La compra está vacía'; end if;
  insert into public.purchases (supplier_id, purchased_on, method, note)
    values (p_supplier_id, coalesce(p_date, (now() at time zone 'America/Bogota')::date), p_method, nullif(trim(p_note), ''))
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
  update public.purchases set total = (select coalesce(sum(total), 0) from public.purchase_items where purchase_id = p.id)
   where id = p.id returning * into p;
  return p;
end $$;

-- ---------- Merma y ajuste por conteo ----------
create or replace function public.register_waste(p_item_id uuid, p_quantity numeric, p_note text)
returns numeric
language plpgsql security invoker set search_path = public as $$
declare v numeric;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if p_quantity <= 0 then raise exception 'Cantidad inválida'; end if;
  insert into public.stock_movements (item_id, kind, quantity, note)
    values (p_item_id, 'merma', -p_quantity, nullif(trim(p_note), ''));
  select stock into v from public.inventory_items where id = p_item_id;
  return v;
end $$;

create or replace function public.adjust_stock(p_item_id uuid, p_counted numeric, p_note text)
returns numeric
language plpgsql security invoker set search_path = public as $$
declare actual numeric;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if p_counted < 0 then raise exception 'Cantidad inválida'; end if;
  select stock into actual from public.inventory_items where id = p_item_id for update;
  if actual is null then raise exception 'Ítem no encontrado'; end if;
  if p_counted <> actual then
    insert into public.stock_movements (item_id, kind, quantity, note)
      values (p_item_id, 'ajuste', p_counted - actual, coalesce(nullif(trim(p_note), ''), 'Conteo'));
  end if;
  return p_counted;
end $$;

-- ---------- Devoluciones de dinero (al anular un pedido ya pagado) ----------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  customer_id uuid references public.customers (id),
  method text not null check (method in ('efectivo', 'nequi', 'breb')),
  amount int not null check (amount > 0),
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Anular (solo admin). Lo que se cargó a la cuenta se descuenta del saldo.
-- Lo que ya se había pagado: queda como saldo a favor del cliente (p_refund_method null)
-- o se registra como devuelto en efectivo, Nequi o Llave Bre-B.
create or replace function public.void_order(p_order_id uuid, p_reason text, p_refund_method text)
returns void
language plpgsql security invoker set search_path = public as $$
declare o public.orders; v_paid int;
begin
  if not public.is_admin() then raise exception 'Solo la administradora puede anular'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Escribe el motivo'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status = 'anulado' then return; end if;

  if o.status = 'cobrado' then
    if o.customer_id is not null then
      insert into public.account_entries (customer_id, order_id, kind, amount, description)
        select o.customer_id, o.id, 'ajuste', -sum(amount), 'Anulación pedido #' || o.number
          from public.account_entries where order_id = o.id and kind = 'cargo'
        having sum(amount) > 0;
    end if;
    select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = o.id and kind = 'venta';
    if v_paid > 0 then
      if p_refund_method is not null then
        insert into public.refunds (order_id, customer_id, method, amount)
          values (o.id, o.customer_id, p_refund_method, v_paid);
      elsif o.customer_id is not null then
        insert into public.account_entries (customer_id, order_id, kind, amount, description)
          values (o.customer_id, o.id, 'ajuste', -v_paid, 'Saldo a favor · anulación pedido #' || o.number);
      else
        raise exception 'Cliente ocasional: indica cómo le devolviste el dinero';
      end if;
    end if;
  end if;

  update public.orders set status = 'anulado', cancel_reason = p_reason, closed_at = coalesce(closed_at, now()) where id = o.id;
  insert into public.audit_log (action, entity, entity_id, reason, data)
    values ('anular', 'pedido', o.id, p_reason,
            jsonb_build_object('pedido', to_jsonb(o), 'pagado', v_paid, 'devolucion', p_refund_method));
end $$;

-- La versión anterior queda sin uso
revoke execute on function public.cancel_order(uuid, text) from public, anon, authenticated;

-- ---------- Cierre de caja ----------
create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  expected_cash int not null,
  counted_cash int not null,
  difference int not null,
  totals jsonb not null default '{}',
  note text,
  closed_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Menú del día ----------
create table public.daily_menus (
  day date primary key,
  title text not null,
  description text,
  updated_by uuid references public.staff (id) default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------- Resúmenes mensuales enviados (corte el 1 de cada mes) ----------
create table public.statement_sends (
  customer_id uuid not null references public.customers (id),
  period date not null, -- primer día del mes del corte
  balance int not null,
  sent_by uuid references public.staff (id) default auth.uid(),
  sent_at timestamptz not null default now(),
  primary key (customer_id, period)
);

-- ---------- Reporte de un periodo (zona horaria de Bogotá) ----------
create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with ventas as (
    select o.* from public.orders o
     where o.status = 'cobrado' and o.closed_at >= p_from and o.closed_at < p_to
  ), lineas as (
    select oi.* from public.order_items oi join ventas v on v.id = oi.order_id
  ), pagos as (
    select * from public.payments where created_at >= p_from and created_at < p_to
  ), devol as (
    select * from public.refunds where created_at >= p_from and created_at < p_to
  ), compras as (
    select * from public.purchases where purchased_on >= (p_from at time zone 'America/Bogota')::date
                                    and purchased_on < (p_to at time zone 'America/Bogota')::date
  )
  select jsonb_build_object(
    'ventas', (select count(*) from ventas),
    'vendido', (select coalesce(sum(total), 0) from ventas),
    'a_cuentas', (select coalesce(sum(e.amount), 0) from public.account_entries e join ventas v on v.id = e.order_id where e.kind = 'cargo'),
    'cobrado', (select coalesce(sum(amount), 0) from pagos),
    'cobrado_ventas', (select coalesce(sum(amount), 0) from pagos where kind = 'venta'),
    'abonos', (select coalesce(sum(amount), 0) from pagos where kind = 'abono'),
    'por_medio', (select coalesce(jsonb_object_agg(method, t), '{}') from (select method, sum(amount) t from pagos group by method) x),
    'devoluciones', (select coalesce(sum(amount), 0) from devol),
    'devol_por_medio', (select coalesce(jsonb_object_agg(method, t), '{}') from (select method, sum(amount) t from devol group by method) x),
    'compras', (select coalesce(sum(total), 0) from compras),
    'compras_por_medio', (select coalesce(jsonb_object_agg(coalesce(method, 'sin dato'), t), '{}') from (select method, sum(total) t from compras group by method) x),
    'costo', (select coalesce(sum(unit_cost * quantity), 0) from lineas where unit_cost is not null),
    'ganancia', (select coalesce(sum((unit_price - unit_cost) * quantity), 0) from lineas where unit_cost is not null),
    'vendido_con_costo', (select coalesce(sum(unit_price * quantity), 0) from lineas where unit_cost is not null),
    'lineas_sin_costo', (select count(*) from lineas where unit_cost is null),
    'por_hora', (select coalesce(jsonb_object_agg(h, n), '{}') from (
        select extract(hour from closed_at at time zone 'America/Bogota')::int h, count(*) n from ventas group by 1) x),
    'por_dia', (select coalesce(jsonb_object_agg(d, t), '{}') from (
        select (closed_at at time zone 'America/Bogota')::date d, sum(total) t from ventas group by 1) x),
    'top', (select coalesce(jsonb_agg(x order by x.cantidad desc), '[]') from (
        select name, sum(quantity) cantidad, sum(unit_price * quantity) total from lineas group by name order by 2 desc limit 10) x),
    'abiertos', (select count(*) from public.orders where status = 'abierto'),
    'abiertos_total', (select coalesce(sum(total), 0) from public.orders where status = 'abierto')
  );
$$;

-- Saldo de cada cliente a una fecha de corte (para los resúmenes del mes)
create or replace function public.balances_at(p_cut timestamptz)
returns table (customer_id uuid, balance int)
language sql stable security invoker set search_path = public as $$
  select c.id, coalesce(sum(e.amount), 0)::int
    from public.customers c
    left join public.account_entries e on e.customer_id = c.id and e.created_at < p_cut
   group by c.id;
$$;

-- ---------- Permisos ----------
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.recipes enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.refunds enable row level security;
alter table public.cash_closings enable row level security;
alter table public.daily_menus enable row level security;
alter table public.statement_sends enable row level security;

do $$
declare t text;
begin
  foreach t in array array['suppliers','inventory_items','recipes','daily_menus','statement_sends'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t || '_staff', t);
  end loop;
  foreach t in array array['purchases','purchase_items','stock_movements','refunds','cash_closings'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_staff())', t || '_insert', t);
  end loop;
end $$;
-- Corregir un cierre de caja: solo la administradora
create policy cash_closings_admin_update on public.cash_closings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke execute on function public.apply_stock_movement() from public, anon, authenticated;
revoke execute on function public.stock_on_order_status() from public, anon, authenticated;
revoke execute on function public.product_cost(uuid) from public, anon;
grant execute on function public.product_cost(uuid) to authenticated;
