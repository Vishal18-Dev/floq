-- FLOQ Beta Redesign Migration
-- Adds store operating mode (FOOD/RETAIL), bilingual name fields, per-store
-- secondary language, PIN-based auth (replacing mock OTP) and day-close records.
-- All new columns are nullable or defaulted so existing rows stay valid.

-- Store operating mode plus bilingual store name
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'FOOD';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS name_local text;

-- Per-store secondary language (ta, hi, mr or none)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS secondary_language text NOT NULL DEFAULT 'none';

-- Bilingual catalogue names
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_local text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_local text;

-- PIN authentication set at onboarding. We store only hashes, never the raw
-- PIN. The attempt counter and lockout timestamp guard against brute force.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until text;

-- Scrub any legacy demo UPI defaults that could misdirect a real payment
UPDATE store_settings SET upi_id = NULL WHERE upi_id = 'sharma.stall@okhdfcbank';
UPDATE store_settings SET upi_name = NULL WHERE upi_name = 'Sharma Breakfast Corner';

-- Day-close snapshots. Open tokens carry to the next business day.
CREATE TABLE IF NOT EXISTS day_closures (
  id text primary key,
  store_id text not null references stores(id),
  business_date text not null,
  closed_at text not null,
  total_revenue numeric(12, 2) not null default 0,
  total_orders integer not null default 0,
  cash_revenue numeric(12, 2) not null default 0,
  upi_revenue numeric(12, 2) not null default 0,
  carried_over_tokens integer not null default 0,
  UNIQUE (store_id, business_date)
);
