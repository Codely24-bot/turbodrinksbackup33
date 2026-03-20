create extension if not exists pgcrypto;

create table if not exists settings (
  id integer primary key,
  store_name text,
  tagline text,
  banner_title text,
  banner_subtitle text,
  address_line text,
  city text,
  maps_url text,
  opening_hours_text text,
  whatsapp_number text,
  quick_message text,
  support_text text,
  delivery_fees jsonb not null default '{}'::jsonb,
  stock_low_threshold integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table settings add column if not exists store_name text;
alter table settings add column if not exists tagline text;
alter table settings add column if not exists banner_title text;
alter table settings add column if not exists banner_subtitle text;
alter table settings add column if not exists address_line text;
alter table settings add column if not exists city text;
alter table settings add column if not exists maps_url text;
alter table settings add column if not exists opening_hours_text text;
alter table settings add column if not exists whatsapp_number text;
alter table settings add column if not exists quick_message text;
alter table settings add column if not exists support_text text;
alter table settings add column if not exists delivery_fees jsonb not null default '{}'::jsonb;
alter table settings add column if not exists stock_low_threshold integer not null default 5;
alter table settings add column if not exists created_at timestamptz not null default now();
alter table settings add column if not exists updated_at timestamptz not null default now();

create table if not exists categories (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table categories add column if not exists created_at timestamptz not null default now();
alter table categories add column if not exists updated_at timestamptz not null default now();

create table if not exists payment_methods (
  value text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_methods add column if not exists label text;
alter table payment_methods add column if not exists active boolean not null default true;
alter table payment_methods add column if not exists created_at timestamptz not null default now();
alter table payment_methods add column if not exists updated_at timestamptz not null default now();

create table if not exists delivery_zones (
  id text primary key,
  name text not null unique,
  fee numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table delivery_zones add column if not exists name text;
alter table delivery_zones add column if not exists fee numeric not null default 0;
alter table delivery_zones add column if not exists active boolean not null default true;
alter table delivery_zones add column if not exists created_at timestamptz not null default now();
alter table delivery_zones add column if not exists updated_at timestamptz not null default now();

create table if not exists products (
  id text primary key,
  name text not null,
  category text not null,
  volume text,
  sale_price numeric not null default 0,
  purchase_price numeric not null default 0,
  stock integer not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  badge text,
  description text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products add column if not exists volume text;
alter table products add column if not exists sale_price numeric not null default 0;
alter table products add column if not exists purchase_price numeric not null default 0;
alter table products add column if not exists stock integer not null default 0;
alter table products add column if not exists active boolean not null default true;
alter table products add column if not exists featured boolean not null default false;
alter table products add column if not exists badge text;
alter table products add column if not exists description text;
alter table products add column if not exists image text;
alter table products add column if not exists created_at timestamptz not null default now();
alter table products add column if not exists updated_at timestamptz not null default now();

create table if not exists promotions (
  id text primary key,
  type text not null default 'daily',
  title text not null,
  description text,
  code text,
  discount_type text not null default 'fixed',
  discount_value numeric not null default 0,
  minimum_order numeric not null default 0,
  neighborhood text,
  active boolean not null default true,
  highlight text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promotions add column if not exists type text not null default 'daily';
alter table promotions add column if not exists description text;
alter table promotions add column if not exists code text;
alter table promotions add column if not exists discount_type text not null default 'fixed';
alter table promotions add column if not exists discount_value numeric not null default 0;
alter table promotions add column if not exists minimum_order numeric not null default 0;
alter table promotions add column if not exists neighborhood text;
alter table promotions add column if not exists active boolean not null default true;
alter table promotions add column if not exists highlight text;
alter table promotions add column if not exists created_at timestamptz not null default now();
alter table promotions add column if not exists updated_at timestamptz not null default now();

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text not null,
  address text not null,
  neighborhood text not null,
  notes text,
  total_spent numeric not null default 0,
  order_ids jsonb not null default '[]'::jsonb,
  last_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customers add column if not exists notes text;
alter table customers add column if not exists total_spent numeric not null default 0;
alter table customers add column if not exists order_ids jsonb not null default '[]'::jsonb;
alter table customers add column if not exists last_order_id text;
alter table customers add column if not exists created_at timestamptz not null default now();
alter table customers add column if not exists updated_at timestamptz not null default now();

create table if not exists riders (
  id text primary key,
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table riders add column if not exists phone text;
alter table riders add column if not exists active boolean not null default true;
alter table riders add column if not exists created_at timestamptz not null default now();
alter table riders add column if not exists updated_at timestamptz not null default now();

create table if not exists orders (
  id text primary key,
  number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  channel text not null default 'delivery',
  customer_id text,
  rider_id text,
  customer jsonb not null default '{}'::jsonb,
  payment_method text,
  payments jsonb,
  paid_total numeric,
  change_due numeric,
  coupon_code text,
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  discount numeric not null default 0,
  manual_discount numeric,
  manual_discount_percent numeric,
  manual_discount_percent_amount numeric,
  manual_surcharge numeric,
  manual_surcharge_percent numeric,
  manual_surcharge_percent_amount numeric,
  promo_discount numeric,
  total numeric not null default 0,
  status text not null default 'received',
  status_timeline jsonb not null default '[]'::jsonb
);

alter table orders add column if not exists channel text not null default 'delivery';
alter table orders add column if not exists customer_id text;
alter table orders add column if not exists rider_id text;
alter table orders add column if not exists customer jsonb not null default '{}'::jsonb;
alter table orders add column if not exists payment_method text;
alter table orders add column if not exists payments jsonb;
alter table orders add column if not exists paid_total numeric;
alter table orders add column if not exists change_due numeric;
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists subtotal numeric not null default 0;
alter table orders add column if not exists delivery_fee numeric not null default 0;
alter table orders add column if not exists discount numeric not null default 0;
alter table orders add column if not exists manual_discount numeric;
alter table orders add column if not exists manual_discount_percent numeric;
alter table orders add column if not exists manual_discount_percent_amount numeric;
alter table orders add column if not exists manual_surcharge numeric;
alter table orders add column if not exists manual_surcharge_percent numeric;
alter table orders add column if not exists manual_surcharge_percent_amount numeric;
alter table orders add column if not exists promo_discount numeric;
alter table orders add column if not exists total numeric not null default 0;
alter table orders add column if not exists status text not null default 'received';
alter table orders add column if not exists status_timeline jsonb not null default '[]'::jsonb;
alter table orders add column if not exists updated_at timestamptz not null default now();

create table if not exists order_items (
  id bigserial primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text,
  name text not null,
  volume text,
  unit_price numeric not null default 0,
  quantity integer not null default 0,
  line_total numeric not null default 0
);

alter table order_items add column if not exists product_id text;
alter table order_items add column if not exists volume text;
alter table order_items add column if not exists unit_price numeric not null default 0;
alter table order_items add column if not exists quantity integer not null default 0;
alter table order_items add column if not exists line_total numeric not null default 0;

create table if not exists expenses (
  id text primary key,
  title text not null,
  category text,
  amount numeric not null default 0,
  date timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table expenses add column if not exists category text;
alter table expenses add column if not exists amount numeric not null default 0;
alter table expenses add column if not exists date timestamptz not null default now();
alter table expenses add column if not exists note text;
alter table expenses add column if not exists created_at timestamptz not null default now();
alter table expenses add column if not exists updated_at timestamptz not null default now();

create table if not exists payables (
  id text primary key,
  title text not null,
  category text,
  amount numeric not null default 0,
  due_date timestamptz not null default now(),
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payables add column if not exists category text;
alter table payables add column if not exists amount numeric not null default 0;
alter table payables add column if not exists due_date timestamptz not null default now();
alter table payables add column if not exists note text;
alter table payables add column if not exists status text not null default 'pending';
alter table payables add column if not exists created_at timestamptz not null default now();
alter table payables add column if not exists updated_at timestamptz not null default now();

create table if not exists receivables (
  id text primary key,
  title text not null,
  customer_name text,
  customer_phone text,
  category text,
  amount numeric not null default 0,
  due_date timestamptz not null default now(),
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table receivables add column if not exists customer_name text;
alter table receivables add column if not exists customer_phone text;
alter table receivables add column if not exists category text;
alter table receivables add column if not exists amount numeric not null default 0;
alter table receivables add column if not exists due_date timestamptz not null default now();
alter table receivables add column if not exists note text;
alter table receivables add column if not exists status text not null default 'pending';
alter table receivables add column if not exists created_at timestamptz not null default now();
alter table receivables add column if not exists updated_at timestamptz not null default now();

create table if not exists cash_sessions (
  id text primary key,
  opened_at timestamptz not null,
  closed_at timestamptz,
  opening_balance numeric not null default 0,
  expected_balance numeric not null default 0,
  counted_balance numeric,
  difference numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cash_sessions add column if not exists closed_at timestamptz;
alter table cash_sessions add column if not exists opening_balance numeric not null default 0;
alter table cash_sessions add column if not exists expected_balance numeric not null default 0;
alter table cash_sessions add column if not exists counted_balance numeric;
alter table cash_sessions add column if not exists difference numeric;
alter table cash_sessions add column if not exists note text;
alter table cash_sessions add column if not exists created_at timestamptz not null default now();
alter table cash_sessions add column if not exists updated_at timestamptz not null default now();

create table if not exists cash_movements (
  id text primary key,
  session_id text not null references cash_sessions(id) on delete cascade,
  type text not null,
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cash_movements add column if not exists type text;
alter table cash_movements add column if not exists amount numeric not null default 0;
alter table cash_movements add column if not exists note text;
alter table cash_movements add column if not exists created_at timestamptz not null default now();
alter table cash_movements add column if not exists updated_at timestamptz not null default now();

create table if not exists support_requests (
  id text primary key,
  customer_name text,
  phone text not null,
  source text not null default 'whatsapp',
  status text not null default 'pending',
  note text,
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table support_requests add column if not exists customer_name text;
alter table support_requests add column if not exists source text not null default 'whatsapp';
alter table support_requests add column if not exists status text not null default 'pending';
alter table support_requests add column if not exists note text;
alter table support_requests add column if not exists requested_at timestamptz;
alter table support_requests add column if not exists created_at timestamptz not null default now();
alter table support_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);
create index if not exists order_items_order_id_idx on order_items (order_id);
create index if not exists customers_phone_idx on customers (phone);
create index if not exists payables_due_date_idx on payables (due_date desc);
create index if not exists receivables_due_date_idx on receivables (due_date desc);
create index if not exists cash_movements_session_id_idx on cash_movements (session_id);
create index if not exists delivery_zones_name_idx on delivery_zones (name);
create index if not exists support_requests_status_idx on support_requests (status);
create index if not exists support_requests_requested_at_idx on support_requests (requested_at desc);
create index if not exists support_requests_phone_idx on support_requests (phone);

create table if not exists admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_name text not null,
  store_name text not null,
  doc_id text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table settings enable row level security;
alter table products enable row level security;
alter table promotions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table customers enable row level security;
alter table admin_profiles enable row level security;

drop policy if exists "public read settings" on settings;
drop policy if exists "public read products" on products;
drop policy if exists "public read promotions" on promotions;

create policy "public read settings"
  on settings for select
  using (true);

create policy "public read products"
  on products for select
  using (true);

create policy "public read promotions"
  on promotions for select
  using (true);

create or replace function create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_items jsonb := payload->'items';
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount numeric := 0;
  v_coupon_code text := coalesce(payload->>'couponCode', '');
  v_neighborhood text := coalesce(payload->>'neighborhood', '');
  v_customer_phone text := coalesce(payload->>'phone', '');
  v_customer_name text := coalesce(payload->>'name', '');
  v_customer_address text := coalesce(payload->>'address', '');
  v_customer_notes text := coalesce(payload->>'note', '');
  v_customer_id text;
  v_order_id text := 'order-' || replace(gen_random_uuid()::text, '-', '');
  v_order_number integer;
  v_status text := 'received';
  v_status_timeline jsonb := jsonb_build_array(jsonb_build_object('status', 'received', 'timestamp', v_now));
  v_coupon record;
  v_shipping record;
  v_settings record;
  v_customer record;
  v_item record;
  v_product record;
  v_items_array jsonb := '[]'::jsonb;
  v_total numeric := 0;
begin
  if v_customer_name = '' or v_customer_phone = '' or v_customer_address = '' or v_neighborhood = '' then
    raise exception 'Preencha nome, telefone, endereco e bairro.';
  end if;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'Adicione ao menos um item ao carrinho.';
  end if;

  select * into v_settings from settings where id = 1;
  if v_settings is null then
    raise exception 'Configuracoes nao encontradas.';
  end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from products where id = (v_item.value->>'productId');

    if v_product is null or v_product.active is not true or v_product.stock <= 0 then
      continue;
    end if;

    if (v_item.value->>'quantity') is null then
      continue;
    end if;

    if (v_item.value->>'quantity')::int <= 0 then
      continue;
    end if;

    if (v_item.value->>'quantity')::int > v_product.stock then
      continue;
    end if;

    v_subtotal := v_subtotal + (v_product.sale_price * (v_item.value->>'quantity')::int);

    v_items_array := v_items_array || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'volume', coalesce(v_product.volume, ''),
      'unitPrice', v_product.sale_price,
      'quantity', (v_item.value->>'quantity')::int,
      'lineTotal', v_product.sale_price * (v_item.value->>'quantity')::int
    ));
  end loop;

  if jsonb_array_length(v_items_array) = 0 then
    raise exception 'Carrinho invalido.';
  end if;

  v_delivery_fee := coalesce((v_settings.delivery_fees ->> v_neighborhood)::numeric, 0);

  select * into v_coupon
    from promotions
    where active is true
      and type = 'coupon'
      and code is not null
      and lower(code) = lower(v_coupon_code)
    limit 1;

  if v_coupon is not null and v_subtotal >= coalesce(v_coupon.minimum_order, 0) then
    if v_coupon.discount_type = 'percentage' then
      v_discount := v_discount + (v_subtotal * coalesce(v_coupon.discount_value, 0) / 100);
    else
      v_discount := v_discount + coalesce(v_coupon.discount_value, 0);
    end if;
  end if;

  select * into v_shipping
    from promotions
    where active is true
      and type = 'shipping'
      and (neighborhood is null or neighborhood = '' or neighborhood = v_neighborhood)
      and v_subtotal >= coalesce(minimum_order, 0)
    limit 1;

  if v_shipping is not null then
    v_delivery_fee := 0;
  end if;

  v_total := greatest(v_subtotal + v_delivery_fee - v_discount, 0);

  select * into v_customer from customers where phone = v_customer_phone limit 1;

  if v_customer is null then
    v_customer_id := 'customer-' || replace(gen_random_uuid()::text, '-', '');
    insert into customers (
      id, name, phone, address, neighborhood, notes, total_spent, order_ids, last_order_id, created_at, updated_at
    ) values (
      v_customer_id, v_customer_name, v_customer_phone, v_customer_address, v_neighborhood, v_customer_notes,
      v_total, jsonb_build_array(v_order_id), v_order_id, v_now, v_now
    );
  else
    v_customer_id := v_customer.id;
    update customers
      set name = v_customer_name,
          phone = v_customer_phone,
          address = v_customer_address,
          neighborhood = v_neighborhood,
          notes = case when v_customer_notes = '' then notes else v_customer_notes end,
          total_spent = coalesce(total_spent, 0) + v_total,
          last_order_id = v_order_id,
          order_ids = coalesce(order_ids, '[]'::jsonb) || jsonb_build_array(v_order_id),
          updated_at = v_now
      where id = v_customer_id;
  end if;

  select coalesce(max(number), 1000) + 1 into v_order_number from orders;

  insert into orders (
    id, number, created_at, updated_at, channel, customer_id, customer, payment_method, payments,
    paid_total, change_due, coupon_code, subtotal, delivery_fee, discount, total, status, status_timeline
  ) values (
    v_order_id,
    v_order_number,
    v_now,
    v_now,
    'delivery',
    v_customer_id,
    jsonb_build_object(
      'name', v_customer_name,
      'phone', v_customer_phone,
      'address', v_customer_address,
      'neighborhood', v_neighborhood,
      'note', v_customer_notes
    ),
    payload->>'paymentMethod',
    null,
    null,
    case when payload->>'paymentMethod' = 'dinheiro' then payload->>'changeFor' else null end,
    v_coupon_code,
    v_subtotal,
    v_delivery_fee,
    v_discount,
    v_total,
    v_status,
    v_status_timeline
  );

  for v_item in select * from jsonb_array_elements(v_items_array) loop
    insert into order_items (
      order_id, product_id, name, volume, unit_price, quantity, line_total
    ) values (
      v_order_id,
      v_item.value->>'productId',
      v_item.value->>'name',
      v_item.value->>'volume',
      (v_item.value->>'unitPrice')::numeric,
      (v_item.value->>'quantity')::int,
      (v_item.value->>'lineTotal')::numeric
    );

    update products
      set stock = stock - (v_item.value->>'quantity')::int,
          updated_at = v_now
      where id = v_item.value->>'productId';
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'number', v_order_number,
    'createdAt', v_now,
    'updatedAt', v_now,
    'channel', 'delivery',
    'customerId', v_customer_id,
    'customer', jsonb_build_object(
      'name', v_customer_name,
      'phone', v_customer_phone,
      'address', v_customer_address,
      'neighborhood', v_neighborhood,
      'note', v_customer_notes
    ),
    'items', v_items_array,
    'paymentMethod', payload->>'paymentMethod',
    'changeFor', case when payload->>'paymentMethod' = 'dinheiro' then payload->>'changeFor' else null end,
    'couponCode', v_coupon_code,
    'subtotal', v_subtotal,
    'deliveryFee', v_delivery_fee,
    'discount', v_discount,
    'total', v_total,
    'status', v_status,
    'statusTimeline', v_status_timeline
  );
end;
$$;

grant execute on function create_order(jsonb) to anon, authenticated;

drop policy if exists "admin profiles read own" on admin_profiles;
drop policy if exists "admin profiles update own" on admin_profiles;

create policy "admin profiles read own"
  on admin_profiles for select
  using (auth.uid() = user_id);

create policy "admin profiles update own"
  on admin_profiles for update
  using (auth.uid() = user_id);

create or replace function handle_new_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner text := coalesce(new.raw_user_meta_data->>'owner_name', '');
  v_store text := coalesce(new.raw_user_meta_data->>'store_name', '');
  v_doc text := coalesce(new.raw_user_meta_data->>'doc_id', '');
begin
  if v_owner = '' or v_store = '' or v_doc = '' then
    return new;
  end if;

  insert into admin_profiles (user_id, owner_name, store_name, doc_id, email)
  values (new.id, v_owner, v_store, v_doc, new.email)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin_profile on auth.users;
create trigger on_auth_user_created_admin_profile
  after insert on auth.users
  for each row execute procedure handle_new_admin_profile();

create or replace function admin_upsert_product(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', '');
  v_now timestamptz := now();
  v_exists boolean := false;
begin
  if v_id = '' then
    raise exception 'Produto invalido.';
  end if;

  select true into v_exists from products where id = v_id limit 1;

  if v_exists then
    update products
      set name = coalesce(payload->>'name', name),
          category = coalesce(payload->>'category', category),
          volume = coalesce(payload->>'volume', volume),
          sale_price = coalesce((payload->>'salePrice')::numeric, (payload->>'price')::numeric, sale_price),
          purchase_price = coalesce((payload->>'purchasePrice')::numeric, purchase_price),
          stock = coalesce((payload->>'stock')::int, stock),
          active = coalesce((payload->>'active')::boolean, active),
          featured = coalesce((payload->>'featured')::boolean, featured),
          badge = coalesce(payload->>'badge', badge),
          description = coalesce(payload->>'description', description),
          image = coalesce(payload->>'image', image),
          updated_at = v_now
      where id = v_id;
  else
    insert into products (
      id, name, category, volume, sale_price, purchase_price, stock, active, featured,
      badge, description, image, created_at, updated_at
    ) values (
      v_id,
      coalesce(payload->>'name', ''),
      coalesce(payload->>'category', ''),
      coalesce(payload->>'volume', ''),
      coalesce((payload->>'salePrice')::numeric, (payload->>'price')::numeric, 0),
      coalesce((payload->>'purchasePrice')::numeric, 0),
      coalesce((payload->>'stock')::int, 0),
      coalesce((payload->>'active')::boolean, true),
      coalesce((payload->>'featured')::boolean, false),
      coalesce(payload->>'badge', ''),
      coalesce(payload->>'description', ''),
      coalesce(payload->>'image', ''),
      v_now,
      v_now
    );
  end if;

  return (select row_to_json(p) from products p where p.id = v_id);
end;
$$;

create or replace function admin_delete_product(product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from products where id = product_id;
end;
$$;

create or replace function admin_toggle_product(product_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
    set active = not active,
        updated_at = now()
  where id = product_id;

  return (select row_to_json(p) from products p where p.id = product_id);
end;
$$;

create or replace function admin_upsert_promotion(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', '');
  v_now timestamptz := now();
  v_exists boolean := false;
begin
  if v_id = '' then
    raise exception 'Promocao invalida.';
  end if;

  select true into v_exists from promotions where id = v_id limit 1;

  if v_exists then
    update promotions
      set type = coalesce(payload->>'type', type),
          title = coalesce(payload->>'title', title),
          description = coalesce(payload->>'description', description),
          code = coalesce(payload->>'code', code),
          discount_type = coalesce(payload->>'discountType', discount_type),
          discount_value = coalesce((payload->>'discountValue')::numeric, discount_value),
          minimum_order = coalesce((payload->>'minimumOrder')::numeric, minimum_order),
          neighborhood = coalesce(payload->>'neighborhood', neighborhood),
          active = coalesce((payload->>'active')::boolean, active),
          highlight = coalesce(payload->>'highlight', highlight),
          updated_at = v_now
      where id = v_id;
  else
    insert into promotions (
      id, type, title, description, code, discount_type, discount_value, minimum_order,
      neighborhood, active, highlight, created_at, updated_at
    ) values (
      v_id,
      coalesce(payload->>'type', 'daily'),
      coalesce(payload->>'title', ''),
      coalesce(payload->>'description', ''),
      coalesce(payload->>'code', ''),
      coalesce(payload->>'discountType', 'fixed'),
      coalesce((payload->>'discountValue')::numeric, 0),
      coalesce((payload->>'minimumOrder')::numeric, 0),
      coalesce(payload->>'neighborhood', ''),
      coalesce((payload->>'active')::boolean, true),
      coalesce(payload->>'highlight', ''),
      v_now,
      v_now
    );
  end if;

  return (select row_to_json(p) from promotions p where p.id = v_id);
end;
$$;

create or replace function admin_delete_promotion(promo_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from promotions where id = promo_id;
end;
$$;

create or replace function admin_upsert_expense(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', '');
  v_now timestamptz := now();
  v_exists boolean := false;
begin
  if v_id = '' then
    raise exception 'Despesa invalida.';
  end if;

  select true into v_exists from expenses where id = v_id limit 1;

  if v_exists then
    update expenses
      set title = coalesce(payload->>'title', title),
          category = coalesce(payload->>'category', category),
          amount = coalesce((payload->>'amount')::numeric, amount),
          date = coalesce((payload->>'date')::timestamptz, date),
          note = coalesce(payload->>'note', note),
          updated_at = v_now
      where id = v_id;
  else
    insert into expenses (
      id, title, category, amount, date, note, created_at, updated_at
    ) values (
      v_id,
      coalesce(payload->>'title', ''),
      coalesce(payload->>'category', ''),
      coalesce((payload->>'amount')::numeric, 0),
      coalesce((payload->>'date')::timestamptz, v_now),
      coalesce(payload->>'note', ''),
      v_now,
      v_now
    );
  end if;

  return (select row_to_json(e) from expenses e where e.id = v_id);
end;
$$;

create or replace function admin_delete_expense(expense_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from expenses where id = expense_id;
end;
$$;

create or replace function admin_upsert_rider(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := coalesce(payload->>'id', '');
  v_now timestamptz := now();
  v_exists boolean := false;
begin
  if v_id = '' then
    raise exception 'Motoboy invalido.';
  end if;

  select true into v_exists from riders where id = v_id limit 1;

  if v_exists then
    update riders
      set name = coalesce(payload->>'name', name),
          phone = coalesce(payload->>'phone', phone),
          active = coalesce((payload->>'active')::boolean, active),
          updated_at = v_now
      where id = v_id;
  else
    insert into riders (
      id, name, phone, active, created_at, updated_at
    ) values (
      v_id,
      coalesce(payload->>'name', ''),
      coalesce(payload->>'phone', ''),
      coalesce((payload->>'active')::boolean, true),
      v_now,
      v_now
    );
  end if;

  return (select row_to_json(r) from riders r where r.id = v_id);
end;
$$;

create or replace function admin_delete_rider(rider_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from riders where id = rider_id;
  update orders set rider_id = null where rider_id = admin_delete_rider.rider_id;
end;
$$;

create or replace function admin_update_order_status(order_id text, next_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_order record;
  v_timeline jsonb;
begin
  select * into v_order from orders where id = order_id;
  if v_order is null then
    raise exception 'Pedido nao encontrado.';
  end if;

  v_timeline := coalesce(v_order.status_timeline, '[]'::jsonb) ||
    jsonb_build_array(jsonb_build_object('status', next_status, 'timestamp', v_now));

  update orders
    set status = next_status,
        updated_at = v_now,
        status_timeline = v_timeline
  where id = order_id;

  return (select row_to_json(o) from orders o where o.id = order_id);
end;
$$;

create or replace function admin_assign_rider(order_id text, rider_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders
    set rider_id = admin_assign_rider.rider_id,
        updated_at = now()
  where id = order_id;

  return (select row_to_json(o) from orders o where o.id = order_id);
end;
$$;

create or replace function admin_update_fees(fees jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update settings
    set delivery_fees = coalesce(fees, '{}'::jsonb),
        updated_at = now()
  where id = 1;

  return (select row_to_json(s) from settings s where s.id = 1);
end;
$$;

revoke execute on function admin_upsert_product(jsonb) from public;
revoke execute on function admin_delete_product(text) from public;
revoke execute on function admin_toggle_product(text) from public;
revoke execute on function admin_upsert_promotion(jsonb) from public;
revoke execute on function admin_delete_promotion(text) from public;
revoke execute on function admin_upsert_expense(jsonb) from public;
revoke execute on function admin_delete_expense(text) from public;
revoke execute on function admin_upsert_rider(jsonb) from public;
revoke execute on function admin_delete_rider(text) from public;
revoke execute on function admin_update_order_status(text, text) from public;
revoke execute on function admin_assign_rider(text, text) from public;
revoke execute on function admin_update_fees(jsonb) from public;

grant execute on function admin_upsert_product(jsonb) to service_role;
grant execute on function admin_delete_product(text) to service_role;
grant execute on function admin_toggle_product(text) to service_role;
grant execute on function admin_upsert_promotion(jsonb) to service_role;
grant execute on function admin_delete_promotion(text) to service_role;
grant execute on function admin_upsert_expense(jsonb) to service_role;
grant execute on function admin_delete_expense(text) to service_role;
grant execute on function admin_upsert_rider(jsonb) to service_role;
grant execute on function admin_delete_rider(text) to service_role;
grant execute on function admin_update_order_status(text, text) to service_role;
grant execute on function admin_assign_rider(text, text) to service_role;
grant execute on function admin_update_fees(jsonb) to service_role;
