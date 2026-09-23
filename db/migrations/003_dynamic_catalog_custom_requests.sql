CREATE TABLE IF NOT EXISTS catalog_config (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_config_singleton CHECK (id = 'primary')
);

CREATE TABLE IF NOT EXISTS custom_hamper_requests (
  id text PRIMARY KEY,
  customer_name text NOT NULL,
  phone text NOT NULL,
  budget_paise integer NOT NULL CHECK (budget_paise >= 0),
  request_text text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_hamper_requests_status CHECK (status IN ('new', 'contacted', 'closed'))
);

CREATE INDEX IF NOT EXISTS custom_hamper_requests_status_created_idx
  ON custom_hamper_requests (status, created_at DESC);
