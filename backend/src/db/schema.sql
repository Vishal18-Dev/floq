-- FLOQ Database Schema
-- Relational SQLite (compatible with PostgreSQL)

PRAGMA foreign_keys = ON;

-- Merchants
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- Stores
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  store_type TEXT NOT NULL DEFAULT 'TEA_STALL',
  address TEXT,
  phone TEXT,
  opening_time TEXT DEFAULT '07:00',
  closing_time TEXT DEFAULT '22:00',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stores_merchant_id ON stores (merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores (slug);

-- Users & Authentication (P0-1 Auth Hardening)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  otp_code TEXT,
  otp_expires_at TEXT,
  role TEXT NOT NULL DEFAULT 'STAFF',
  merchant_id TEXT NOT NULL,
  store_ids_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_merchant ON users (merchant_id);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_store_id ON staff (store_id);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VENDOR',
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_store_id ON devices (store_id);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories (store_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image_url TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  station TEXT NOT NULL DEFAULT 'GENERAL',
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

-- Modifiers
CREATE TABLE IF NOT EXISTS modifiers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_modifiers_product_id ON modifiers (product_id);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL UNIQUE,
  current_stock INTEGER NOT NULL DEFAULT 100,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT 'units',
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory_items (store_id);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers (store_id);

-- Orders (Unified table with client_order_id idempotency & business_date)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  client_order_id TEXT,
  store_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  source TEXT NOT NULL DEFAULT 'STAFF_POS',
  status TEXT NOT NULL DEFAULT 'NEW',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  ticket_number TEXT NOT NULL,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  accepted_at TEXT,
  preparing_at TEXT,
  ready_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  UNIQUE (store_id, client_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders (store_id, client_order_id);

-- Order Items (Snapshotting product name & price)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_price_snapshot REAL NOT NULL,
  quantity INTEGER NOT NULL,
  modifiers_json TEXT,
  subtotal REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  amount REAL NOT NULL,
  provider_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);

-- Queue Tickets (Enforces unique ticket numbers per store per business date)
CREATE TABLE IF NOT EXISTS queue_tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  ticket_number TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
  called_at TEXT,
  ready_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  UNIQUE (store_id, business_date, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_queue_tickets_store ON queue_tickets (store_id, created_at);

-- Daily Atomic Ticket Generator Sequence Table (P0-4 Atomic Concurrency)
CREATE TABLE IF NOT EXISTS ticket_sequences (
  store_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  last_ticket_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, business_date)
);

-- Store Settings
CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL UNIQUE,
  voice_enabled INTEGER NOT NULL DEFAULT 1,
  voice_language TEXT NOT NULL DEFAULT 'en-IN',
  voice_verbosity TEXT NOT NULL DEFAULT 'BRIEF',
  typical_prep_time_minutes INTEGER NOT NULL DEFAULT 6,
  ticket_prefix TEXT NOT NULL DEFAULT '#',
  auto_accept_qr_orders INTEGER NOT NULL DEFAULT 0,
  upi_id TEXT DEFAULT 'sharma.stall@okhdfcbank',
  upi_name TEXT DEFAULT 'Sharma Breakfast Corner',
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

-- Audit Logs (P0 Audit Trail for Transactions & Security)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  store_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_store ON audit_logs (store_id, created_at);
