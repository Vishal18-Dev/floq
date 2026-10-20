-- FLOQ Store Profile Migration
-- Self-serve onboarding captures a store photo and city. Both nullable so
-- existing rows and white-glove onboarding stay valid.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city text;
