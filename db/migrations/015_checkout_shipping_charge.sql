ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_paise integer NOT NULL DEFAULT 0;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_shipping_paise_nonnegative;

ALTER TABLE orders
  ADD CONSTRAINT orders_shipping_paise_nonnegative CHECK (shipping_paise >= 0);
