-- Owner-approved packaging rules, PRELAUNCH ONLY.
-- Additive staging schema: no orders, payments, catalogue, inventory or
-- launch-gate flags are modified. Prices below remain NULL until owner approval.
CREATE TABLE self_build_packaging_costs (
  box_id text PRIMARY KEY CHECK (box_id IN ('kappa','corrugated','bag-clear','bag-print')),
  -- This is the COMPLETE internal packing cost: box + ribbon + filler + inserts.
  total_cost_paise integer NULL CHECK (total_cost_paise BETWEEN 1 AND 2147483647),
  approved boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_build_packaging_approved_has_cost CHECK (NOT approved OR total_cost_paise IS NOT NULL)
);
INSERT INTO self_build_packaging_costs(box_id)
VALUES ('kappa'),('corrugated'),('bag-clear'),('bag-print');

-- Old drafts/orders remain readable; buyer checkout must reject NULL box_id.
ALTER TABLE self_build_drafts
  ADD COLUMN box_id text NULL
  CHECK (box_id IS NULL OR box_id IN ('kappa','corrugated','bag-clear','bag-print'));
ALTER TABLE self_build_order_snapshots
  ADD COLUMN box_id text NULL
  CHECK (box_id IS NULL OR box_id IN ('kappa','corrugated','bag-clear','bag-print'));

-- Intentionally DO NOT populate costs, approve choices or enable customer mode.
