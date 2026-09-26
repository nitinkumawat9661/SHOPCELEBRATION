ALTER TABLE orders
  ALTER COLUMN payment_reference DROP NOT NULL;

ALTER TABLE orders
  ALTER COLUMN payment_reference_hash DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_provider text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_order_id text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_session_id text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_error_code text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_order_uq
  ON orders (payment_provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_payment_uq
  ON orders (payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  provider text NOT NULL,
  provider_order_id text NOT NULL,
  provider_session_id text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_attempts_order_no_uq UNIQUE (order_id, attempt_no),
  CONSTRAINT payment_attempts_provider_order_uq UNIQUE (provider, provider_order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_provider_payment_uq
  ON payment_attempts (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_order_created_idx
  ON payment_attempts (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_uq UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_order_created_idx
  ON payment_events (order_id, created_at DESC);
