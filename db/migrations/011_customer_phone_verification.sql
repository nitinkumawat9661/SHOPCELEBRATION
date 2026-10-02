ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
