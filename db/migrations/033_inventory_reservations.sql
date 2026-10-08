CREATE TABLE IF NOT EXISTS product_inventory (
  product_id text PRIMARY KEY,
  available_quantity integer NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES product_inventory(product_id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reservations_order_product_uq UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS inventory_reservations_expiry_idx
  ON inventory_reservations (status, expires_at)
  WHERE status = 'reserved';

INSERT INTO product_inventory (product_id, available_quantity)
SELECT DISTINCT product ->> 'id', 1
FROM catalog_config,
LATERAL jsonb_array_elements(payload -> 'products') AS product
WHERE COALESCE((product ->> 'sellIndividually')::boolean, false) = true
  AND COALESCE((product ->> 'active')::boolean, true) = true
  AND NULLIF(product ->> 'id', '') IS NOT NULL
ON CONFLICT (product_id) DO NOTHING;
