-- FLOQ Subscription Migration
-- Manual-UPI, paywall-gated subscriptions. One subscription row per store.
-- Effective status (trial expiry, period expiry) is computed at read time from
-- the dates, so no scheduled job is needed to flip rows.

CREATE TABLE IF NOT EXISTS subscriptions (
  store_id text primary key references stores(id),
  plan text,
  status text not null default 'trial',
  trial_ends_at text,
  current_period_end text,
  updated_at text not null
);

-- Manual UPI payment submissions awaiting admin verification.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id text primary key,
  store_id text not null references stores(id),
  plan text not null,
  amount numeric(10, 2) not null,
  upi_reference text,
  status text not null default 'pending',
  submitted_at text not null,
  verified_at text,
  period_end text
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_store ON subscription_payments (store_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON subscription_payments (status);

-- Existing beta merchants are exempted (active, far-future period) by a one-off
-- ops script after deploy, not here — the INSERT..SELECT backfill is not worth
-- making portable to the in-memory test DB. New stores auto-provision a trial.
