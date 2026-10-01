ALTER TABLE orders
  ALTER COLUMN tier_id DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN order_type text NOT NULL DEFAULT 'hamper'
    CHECK (order_type IN ('hamper', 'individual')),
  ADD COLUMN line_items jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(line_items) = 'array');

ALTER TABLE orders
  ADD CONSTRAINT orders_purchase_type_check CHECK (
    (order_type = 'hamper' AND tier_id IS NOT NULL AND jsonb_array_length(line_items) = 0)
    OR
    (order_type = 'individual' AND tier_id IS NULL AND jsonb_array_length(line_items) BETWEEN 1 AND 20)
  );
