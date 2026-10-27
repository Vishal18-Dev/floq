-- FLOQ Retail Suite Migration
-- Turns the flat catalogue into a shop catalogue: products sell in pack sizes
-- or loose by weight, every SKU carries a live stock count, cost and wholesale
-- price. Shops and regulars buy on credit against a limit, tracked in a dues
-- ledger. Each category has a default supplier for one-tap reorder.
-- Every column is nullable or defaulted so existing FOOD stores stay valid.

-- Category default supplier (retail reorder target). Nullable.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS supplier text;

-- Loose goods sold by weight live on the product row (grams throughout).
-- Packed goods keep price=0 here and carry their real prices on product_packs.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_loose boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS per_kg numeric(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_grams numeric(12, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_grams numeric(12, 3);

-- Pack sizes for a packed product. Each row is a sellable SKU.
CREATE TABLE IF NOT EXISTS product_packs (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  store_id text not null references stores(id),
  size text not null,
  price numeric(10, 2) not null,
  wholesale_price numeric(10, 2),
  cost_price numeric(10, 2),
  stock integer not null default 0,
  case_qty integer,
  daily_rate numeric(10, 3) not null default 0,
  expiry_note text,
  sort_order integer not null default 0
);

CREATE INDEX IF NOT EXISTS idx_packs_product ON product_packs(product_id);
CREATE INDEX IF NOT EXISTS idx_packs_store ON product_packs(store_id);

-- Credit customers: shops (wholesale) and walk-in regulars. owes/oldest_due_at
-- are denormalised from dues_entries for a fast Dues screen. The ledger is the
-- source of truth and is replayed on load.
CREATE TABLE IF NOT EXISTS credit_customers (
  id text primary key,
  store_id text not null references stores(id),
  name text not null,
  kind text not null default 'REGULAR',
  phone text,
  credit_limit numeric(12, 2) not null default 0,
  owes numeric(12, 2) not null default 0,
  oldest_due_at text,
  created_at text
);

CREATE INDEX IF NOT EXISTS idx_credit_customers_store ON credit_customers(store_id);

-- Dues ledger. CHARGE when a credit sale/invoice goes on the account, PAYMENT
-- when money comes back. Balance = sum(amount), and "collected today" filters
-- PAYMENT rows by business_date.
CREATE TABLE IF NOT EXISTS dues_entries (
  id text primary key,
  store_id text not null references stores(id),
  customer_id text not null references credit_customers(id),
  order_id text,
  kind text not null,
  amount numeric(12, 2) not null,
  note text,
  business_date text,
  created_at text
);

CREATE INDEX IF NOT EXISTS idx_dues_store_date ON dues_entries(store_id, business_date);
CREATE INDEX IF NOT EXISTS idx_dues_customer ON dues_entries(customer_id);

-- Retail order fields: how it was paid, whether it was a wholesale shop order,
-- which account carries it on credit, the invoice number and cash tendered.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_wholesale boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_customer_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_tendered numeric(10, 2);

-- Order lines reference a pack (or a loose product), record the unit they were
-- sold in, and snapshot the cost so the Day screen can show real profit.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pack_id text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sell_unit text NOT NULL DEFAULT 'UNIT';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_snapshot numeric(10, 2);

-- Per-store invoice counter for shop orders (FL-0231 ...).
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_invoice_number integer NOT NULL DEFAULT 230;
