-- FLOQ PostgreSQL Initial Migration: Schema Definition

CREATE TABLE IF NOT EXISTS schema_migrations (
  version int primary key,
  name text,
  applied_at text
);

CREATE TABLE IF NOT EXISTS merchants (
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  status text default 'ACTIVE',
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS stores (
  id text primary key,
  merchant_id text not null references merchants(id),
  name text not null,
  slug text unique not null,
  store_type text not null,
  address text,
  phone text,
  opening_time text,
  closing_time text,
  timezone text default 'Asia/Kolkata',
  status text default 'ACTIVE',
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS store_settings (
  id text primary key,
  store_id text unique not null references stores(id),
  upi_id text,
  upi_name text,
  voice_enabled boolean default true,
  voice_language text default 'en-IN',
  voice_verbosity text default 'BRIEF',
  typical_prep_time_minutes integer default 6,
  ticket_prefix text default '#',
  auto_accept_qr_orders boolean default true
);

CREATE TABLE IF NOT EXISTS users (
  id text primary key,
  phone text unique not null,
  name text,
  role text not null,
  merchant_id text not null references merchants(id),
  store_ids_json jsonb default '[]'::jsonb,
  otp_code text,
  otp_expires_at text,
  status text default 'ACTIVE',
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS staff (
  id text primary key,
  store_id text not null references stores(id),
  name text not null,
  phone text not null,
  role text not null,
  status text default 'ACTIVE',
  created_at text
);

CREATE TABLE IF NOT EXISTS devices (
  id text primary key,
  store_id text not null references stores(id),
  name text not null,
  role text not null,
  last_active_at text,
  created_at text
);

CREATE TABLE IF NOT EXISTS categories (
  id text primary key,
  store_id text not null references stores(id),
  name text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at text
);

CREATE TABLE IF NOT EXISTS products (
  id text primary key,
  store_id text not null references stores(id),
  category_id text not null references categories(id),
  name text not null,
  description text,
  price numeric(10, 2) not null,
  is_available boolean default true,
  sort_order integer default 0,
  station text,
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS orders (
  id text primary key,
  client_order_id text,
  store_id text not null references stores(id),
  business_date text not null,
  source text not null,
  status text not null,
  payment_status text not null,
  ticket_number text not null,
  subtotal numeric(10, 2) not null,
  discount numeric(10, 2) default 0,
  total numeric(10, 2) not null,
  customer_id text,
  notes text,
  created_at text,
  accepted_at text,
  preparing_at text,
  ready_at text,
  completed_at text,
  cancelled_at text,
  cancellation_reason text,
  actor_id text
);

CREATE TABLE IF NOT EXISTS order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  product_id text not null,
  product_name_snapshot text not null,
  unit_price_snapshot numeric(10, 2) not null,
  quantity integer not null,
  modifiers_json jsonb,
  subtotal numeric(10, 2) not null
);

CREATE TABLE IF NOT EXISTS payments (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  provider_reference text,
  method text not null,
  status text not null,
  amount numeric(10, 2) not null,
  created_at text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS queue_tickets (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  store_id text not null references stores(id),
  business_date text not null,
  ticket_number text not null,
  created_at text,
  called_at text,
  completed_at text
);

CREATE TABLE IF NOT EXISTS ticket_sequences (
  store_id text not null references stores(id),
  business_date text not null,
  last_ticket_number integer not null default 0,
  primary key (store_id, business_date)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text primary key,
  actor_id text,
  store_id text,
  action text not null,
  entity_type text,
  entity_id text,
  amount numeric(10, 2),
  metadata_json jsonb,
  created_at text
);

CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, business_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_queue_store_date ON queue_tickets(store_id, business_date);
