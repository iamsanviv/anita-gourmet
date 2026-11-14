-- Anita Gourmet · Fase 1: productos, clientes, pedidos, cobros y cuentas.
-- Montos en pesos colombianos (COP), enteros.


-- ---------- Personal (Anita y empleados) ----------
create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active and role = 'admin');
$$;

-- ---------- Catálogo ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '🍽️',
  sort int not null default 0,
  active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null,
  price int not null check (price >= 0),
  icon text not null default '🍽️',
  active boolean not null default true,      -- se vende en general
  available_today boolean not null default true, -- false = agotado hoy
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

-- Grupos de opciones: "Tamaño" (obligatorio, una), "Extras" (opcional, varias)
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  required boolean not null default false,
  multiple boolean not null default false,
  sort int not null default 0
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null,
  price_delta int not null default 0, -- se suma al precio base
  sort int not null default 0
);

-- ---------- Clientes ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cedula text unique,
  phone text,
  email text,
  blocked boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Pedidos ----------
create sequence public.order_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.order_number_seq'),
  customer_id uuid references public.customers (id),
  guest_name text,                       -- cliente ocasional con nombre provisional
  status text not null default 'abierto' check (status in ('abierto', 'cobrado', 'anulado')),
  total int not null default 0 check (total >= 0),
  note text,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  cancel_reason text,
  check (customer_id is not null or guest_name is not null)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id),
  name text not null,                    -- copia del nombre al momento de vender
  unit_price int not null check (unit_price >= 0), -- precio base + opciones
  quantity int not null check (quantity > 0),
  options jsonb not null default '[]',   -- [{group, name, price_delta}]
  note text
);

-- ---------- Dinero ----------
-- Pagos recibidos (venta pagada o abono). Medios: efectivo, Nequi, Llave Bre-B.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id),
  customer_id uuid references public.customers (id),
  kind text not null check (kind in ('venta', 'abono')),
  method text not null check (method in ('efectivo', 'nequi', 'breb')),
  amount int not null check (amount > 0),
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Movimientos de la cuenta del cliente: cargo suma deuda, abono la resta.
create table public.account_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  order_id uuid references public.orders (id),
  payment_id uuid references public.payments (id),
  kind text not null check (kind in ('cargo', 'abono', 'ajuste')),
  amount int not null, -- positivo: aumenta saldo; negativo: lo reduce
  description text,
  created_by uuid references public.staff (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Registro de cambios hechos por Anita (anular, editar)
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid(),
  action text not null,
  entity text not null,
  entity_id uuid,
  reason text,
  data jsonb,
  created_at timestamptz not null default now()
);

create view public.customer_balances with (security_invoker = true) as
  select c.id as customer_id,
         coalesce(sum(e.amount), 0)::int as balance,
         max(e.created_at) as last_movement
    from public.customers c
    left join public.account_entries e on e.customer_id = c.id
   group by c.id;

create index on public.orders (status, created_at desc);
create index on public.order_items (order_id);
create index on public.account_entries (customer_id, created_at desc);
create index on public.payments (created_at);

-- ---------- Cobrar un pedido (atómico) ----------
-- p_pay_now: lo que paga ahora (0 = todo a la cuenta). El resto va a la cuenta.
create or replace function public.checkout_order(p_order_id uuid, p_pay_now int, p_method text)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  o public.orders;
  v_payment uuid;
  v_rest int;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'abierto' then raise exception 'El pedido ya está %', o.status; end if;
  if p_pay_now < 0 or p_pay_now > o.total then raise exception 'Monto inválido'; end if;

  v_rest := o.total - p_pay_now;
  if v_rest > 0 and o.customer_id is null then
    raise exception 'Un cliente ocasional debe pagar el total';
  end if;

  if p_pay_now > 0 then
    if p_method is null then raise exception 'Falta el medio de pago'; end if;
    insert into public.payments (order_id, customer_id, kind, method, amount)
      values (o.id, o.customer_id, 'venta', p_method, p_pay_now) returning id into v_payment;
  end if;

  if v_rest > 0 then
    insert into public.account_entries (customer_id, order_id, kind, amount, description)
      values (o.customer_id, o.id, 'cargo', v_rest, 'Pedido #' || o.number);
  end if;

  update public.orders set status = 'cobrado', closed_at = now() where id = o.id returning * into o;
  return o;
end $$;

-- ---------- Registrar un abono ----------
create or replace function public.register_abono(p_customer_id uuid, p_amount int, p_method text)
returns int
language plpgsql security invoker set search_path = public as $$
declare v_payment uuid; v_balance int;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if p_amount <= 0 then raise exception 'Monto inválido'; end if;
  insert into public.payments (customer_id, kind, method, amount)
    values (p_customer_id, 'abono', p_method, p_amount) returning id into v_payment;
  insert into public.account_entries (customer_id, payment_id, kind, amount, description)
    values (p_customer_id, v_payment, 'abono', -p_amount, 'Abono');
  select balance into v_balance from public.customer_balances where customer_id = p_customer_id;
  return v_balance;
end $$;

-- ---------- Anular un pedido (solo admin, con motivo) ----------
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security invoker set search_path = public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Solo la administradora puede anular'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Escribe el motivo'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.status = 'anulado' then return; end if;
  if o.status = 'cobrado' and o.customer_id is not null then
    -- revierte lo que se cargó a la cuenta
    insert into public.account_entries (customer_id, order_id, kind, amount, description)
      select o.customer_id, o.id, 'ajuste', -sum(amount), 'Anulación pedido #' || o.number
        from public.account_entries where order_id = o.id and kind = 'cargo'
      having sum(amount) > 0;
  end if;
  update public.orders set status = 'anulado', cancel_reason = p_reason, closed_at = now() where id = o.id;
  insert into public.audit_log (action, entity, entity_id, reason, data)
    values ('anular', 'pedido', o.id, p_reason, to_jsonb(o));
end $$;

-- ---------- Permisos (RLS) ----------
alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.account_entries enable row level security;
alter table public.audit_log enable row level security;

create policy staff_read on public.staff for select to authenticated using (public.is_staff());
create policy staff_admin on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- El personal lee y escribe catálogo, clientes y pedidos.
do $$
declare t text;
begin
  foreach t in array array['categories','products','option_groups','options','customers','orders','order_items'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t || '_staff', t);
  end loop;
end $$;

-- Dinero: el personal lee; las escrituras pasan por las funciones de arriba.
create policy payments_read on public.payments for select to authenticated using (public.is_staff());
create policy payments_insert on public.payments for insert to authenticated with check (public.is_staff());
create policy entries_read on public.account_entries for select to authenticated using (public.is_staff());
create policy entries_insert on public.account_entries for insert to authenticated with check (public.is_staff());
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());
create policy audit_insert on public.audit_log for insert to authenticated with check (public.is_staff());

-- Un pedido cobrado o anulado solo lo cambia la administradora.
create or replace function public.guard_closed_orders() returns trigger
language plpgsql as $$
begin
  if old.status <> 'abierto' and not public.is_admin() then
    raise exception 'Solo la administradora puede modificar un pedido cerrado';
  end if;
  return new;
end $$;
create trigger orders_guard before update on public.orders
  for each row execute function public.guard_closed_orders();

-- Recalcula el total del pedido cuando cambian sus productos.
create or replace function public.recalc_order_total() returns trigger
language plpgsql as $$
declare v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders
     set total = coalesce((select sum(unit_price * quantity) from public.order_items where order_id = v_order), 0)
   where id = v_order and status = 'abierto';
  return null;
end $$;
create trigger order_items_total after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_total();

-- ---------- Alta de personal ----------
-- La administradora registra el correo aquí; cuando se crea el usuario
-- (desde el panel de Supabase o desde la app), queda como personal.
create table public.staff_invites (
  email text primary key,
  full_name text not null,
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
create policy invites_admin on public.staff_invites for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.link_staff_from_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare i public.staff_invites;
begin
  select * into i from public.staff_invites where lower(email) = lower(new.email);
  if i.email is not null then
    insert into public.staff (id, full_name, role) values (new.id, i.full_name, i.role)
      on conflict (id) do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_staff_from_invite();

-- Tiempo real para el contador de pedidos abiertos
alter publication supabase_realtime add table public.orders;

-- ---------- Guardar pedido (nuevo o editado) en un solo paso ----------
-- p_items: [{product_id, name, unit_price, quantity, options, note}]
create or replace function public.save_order(
  p_order_id uuid, p_customer_id uuid, p_guest_name text, p_items jsonb
) returns public.orders
language plpgsql security invoker set search_path = public as $$
declare o public.orders;
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'El pedido está vacío'; end if;
  if p_customer_id is null and coalesce(trim(p_guest_name), '') = '' then
    raise exception 'Elige un cliente o escribe un nombre provisional';
  end if;

  if p_order_id is null then
    insert into public.orders (customer_id, guest_name)
      values (p_customer_id, case when p_customer_id is null then trim(p_guest_name) end)
      returning * into o;
  else
    select * into o from public.orders where id = p_order_id for update;
    if o.status <> 'abierto' then raise exception 'Solo se editan pedidos abiertos'; end if;
    update public.orders
       set customer_id = p_customer_id,
           guest_name = case when p_customer_id is null then trim(p_guest_name) end
     where id = o.id;
    delete from public.order_items where order_id = o.id;
  end if;

  insert into public.order_items (order_id, product_id, name, unit_price, quantity, options, note)
    select o.id, (i->>'product_id')::uuid, i->>'name', (i->>'unit_price')::int, (i->>'quantity')::int,
           coalesce(i->'options', '[]'), nullif(trim(i->>'note'), '')
      from jsonb_array_elements(p_items) as i;

  select * into o from public.orders where id = o.id;
  return o;
end $$;
