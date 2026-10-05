ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_carrier_id text,
  ADD COLUMN IF NOT EXISTS shipping_label_url text,
  ADD COLUMN IF NOT EXISTS shipping_booked_at timestamptz;
