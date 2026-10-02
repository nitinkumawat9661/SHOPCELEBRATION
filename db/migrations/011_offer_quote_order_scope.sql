ALTER TABLE offer_quotes
  ALTER COLUMN tier_id DROP NOT NULL;

ALTER TABLE offer_quotes
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'hamper'
    CHECK (order_type IN ('hamper', 'individual')),
  ADD COLUMN IF NOT EXISTS cart_key text;
