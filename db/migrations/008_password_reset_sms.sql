ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS customer_password_reset_challenges (
  id text PRIMARY KEY,
  customer_account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_password_reset_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS customer_password_reset_phone_created_idx
  ON customer_password_reset_challenges (phone, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_password_reset_expiry_idx
  ON customer_password_reset_challenges (expires_at)
  WHERE consumed_at IS NULL;
