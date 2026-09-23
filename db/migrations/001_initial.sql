CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  public_id text NOT NULL,
  idempotency_key text NOT NULL,
  tracking_token_hash text NOT NULL,
  tracking_expires_at timestamptz NOT NULL,
  tier_id text NOT NULL,
  tier_name text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  selected_product_ids text[] NOT NULL DEFAULT '{}',
  required_date date NOT NULL,
  occasion text NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  receiver_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL,
  gift_message text NOT NULL DEFAULT '',
  payment_reference text NOT NULL,
  payment_reference_hash text NOT NULL,
  payment_status text NOT NULL,
  status text NOT NULL,
  policy_version text NOT NULL,
  packing_video_key text,
  customer_approved_at timestamptz,
  shipping_provider text,
  shipping_tracking_number text,
  issue_type text,
  issue_note text,
  issue_reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_public_id_uq UNIQUE (public_id),
  CONSTRAINT orders_idempotency_key_uq UNIQUE (idempotency_key),
  CONSTRAINT orders_tracking_token_hash_uq UNIQUE (tracking_token_hash),
  CONSTRAINT orders_payment_reference_hash_uq UNIQUE (payment_reference_hash)
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone);

CREATE TABLE IF NOT EXISTS order_events (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_created_idx ON order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count >= 0)
);
