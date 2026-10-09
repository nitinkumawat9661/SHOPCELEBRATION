-- A single editable default delivery address per verified customer.
-- Address data stays in the account database, never in public catalog or analytics.
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS default_address jsonb;
