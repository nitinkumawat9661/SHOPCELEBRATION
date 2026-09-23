ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

UPDATE orders
SET delivered_at = updated_at
WHERE status IN ('delivered', 'issue_reported', 'refund_or_replacement_resolved')
  AND delivered_at IS NULL;
