ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS customer_accounts_verified_phone_idx
  ON customer_accounts (phone)
  WHERE phone_verified_at IS NOT NULL;
