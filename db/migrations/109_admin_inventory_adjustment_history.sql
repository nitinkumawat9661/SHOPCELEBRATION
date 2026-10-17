-- Admin V3: audit-only stock adjustment history. No change to existing
-- product_inventory, inventory_reservations or customer checkout semantics.
-- Run against isolated staging first and review migrations before production.
CREATE TABLE IF NOT EXISTS admin_inventory_adjustments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  product_id text NOT NULL REFERENCES product_inventory(product_id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('set', 'add', 'remove')),
  quantity_input integer NOT NULL CHECK (quantity_input BETWEEN 0 AND 10000),
  expected_available integer NOT NULL CHECK (expected_available BETWEEN 0 AND 10000),
  previous_available integer NOT NULL CHECK (previous_available BETWEEN 0 AND 10000),
  new_available integer NOT NULL CHECK (new_available BETWEEN 0 AND 10000),
  delta integer NOT NULL CHECK (delta BETWEEN -10000 AND 10000),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 4 AND 240),
  actor text NOT NULL DEFAULT 'authenticated-admin'
    CHECK (actor = 'authenticated-admin'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_inventory_adjustments_product_time_idx
  ON admin_inventory_adjustments (product_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS admin_inventory_adjustments_recent_idx
  ON admin_inventory_adjustments (created_at DESC, id DESC);

COMMENT ON TABLE admin_inventory_adjustments IS
  'Audited admin-initiated adjustments to available-to-sell quantities only; reservations and physical stock are separate.';
