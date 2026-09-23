CREATE TABLE IF NOT EXISTS customer_accounts (
  id text PRIMARY KEY,
  phone text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_phone_uq UNIQUE (phone),
  CONSTRAINT customer_accounts_status_check CHECK (status IN ('active', 'disabled'))
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_account_id text REFERENCES customer_accounts(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS selected_product_names text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS orders_customer_account_created_idx
  ON orders (customer_account_id, created_at DESC)
  WHERE customer_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_revisions (
  id bigserial PRIMARY KEY,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_revisions_created_idx
  ON catalog_revisions (created_at DESC);

CREATE TABLE IF NOT EXISTS store_settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
