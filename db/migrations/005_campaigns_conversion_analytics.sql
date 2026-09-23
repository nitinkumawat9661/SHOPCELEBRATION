CREATE TABLE IF NOT EXISTS campaign_config (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_config_singleton CHECK (id = 'primary')
);

CREATE TABLE IF NOT EXISTS offer_quotes (
  id uuid PRIMARY KEY,
  campaign_id text NOT NULL,
  campaign_title text NOT NULL,
  customer_account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('checkout', 'hesitation')),
  tier_id text NOT NULL,
  selected_product_ids text[] NOT NULL DEFAULT '{}',
  subtotal_paise integer NOT NULL CHECK (subtotal_paise >= 0),
  discount_paise integer NOT NULL CHECK (discount_paise >= 0),
  payable_paise integer NOT NULL CHECK (payable_paise >= 0),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_quotes_campaign_active_idx ON offer_quotes (campaign_id, expires_at) WHERE redeemed_at IS NULL;
CREATE INDEX IF NOT EXISTS offer_quotes_customer_idx ON offer_quotes (customer_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversion_events (
  id uuid PRIMARY KEY,
  session_hash text NOT NULL,
  customer_account_id text REFERENCES customer_accounts(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  tier_id text,
  campaign_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversion_events_created_idx ON conversion_events (created_at DESC);
CREATE INDEX IF NOT EXISTS conversion_events_name_created_idx ON conversion_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS conversion_events_campaign_created_idx ON conversion_events (campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_paise integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_paise integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_title text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_quote_id uuid;
UPDATE orders SET subtotal_paise = amount_paise WHERE subtotal_paise IS NULL;
ALTER TABLE orders ALTER COLUMN subtotal_paise SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_offer_quote_unique_idx ON orders (offer_quote_id) WHERE offer_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_campaign_created_idx ON orders (campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;
