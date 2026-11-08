-- FLOQ Self-Serve Onboarding + Team Migration
-- Adds the fields the onboarding wizard captures (GSTIN, credit on/off plus a
-- default limit, food service preferences) and the staff-invite subsystem that
-- lets an owner invite helpers who join with a code. All new columns are
-- nullable or defaulted so existing rows and white-glove onboarding stay valid.

-- Tax identity (prints on wholesale invoices). Blank = bill of supply.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS gstin text;

-- Credit (udhaar) is on by default. When a merchant says "cash and UPI only"
-- at onboarding we flip this off and hide credit everywhere in the app.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS credit_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_credit_limit integer;

-- Food counter preferences captured at onboarding (pay-first, call-by, order
-- types taken, closed days). Stored as JSON so the queue can grow into them
-- without a column per answer.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS service_prefs_json text;

-- Staff invites. The owner generates a code for a specific mobile number and a
-- role. The invitee joins by entering the code and verifying THAT number by
-- OTP. Codes are single-use, expire in 7 days and can be revoked.
CREATE TABLE IF NOT EXISTS staff_invites (
  id text primary key,
  store_id text not null references stores(id),
  merchant_id text not null references merchants(id),
  code text unique not null,
  invited_phone text,
  role text not null,
  title text,
  created_by text,
  status text not null default 'PENDING',
  expires_at text not null,
  created_at text not null,
  accepted_at text,
  accepted_user_id text
);
