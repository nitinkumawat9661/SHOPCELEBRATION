-- Self-Build payment / refund reconciliation alerts. Additive ONLY, no inventory.
-- Signed gateway callbacks flow through existing payments/store; this ledger
-- records paid cancellations and money received after cancellation for human
-- verification. NO automatic refund, payout or category stock mutation.
CREATE TABLE self_build_payment_reviews (
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('PAID_ORDER_CANCELLED','LATE_PAYMENT_AFTER_CANCELLATION')),
  review_status text NOT NULL DEFAULT 'open' CHECK (review_status IN ('open','documented')),
  external_ref text NULL CHECK (external_ref IS NULL OR (char_length(external_ref) BETWEEN 4 AND 140)),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note)<=500),
  created_at timestamptz NOT NULL DEFAULT now(),
  documented_at timestamptz,
  PRIMARY KEY(order_id,reason),
  CONSTRAINT self_build_review_doc_state CHECK (
    (review_status='open' AND documented_at IS NULL)
    OR (review_status='documented' AND documented_at IS NOT NULL)
  )
);
CREATE INDEX self_build_payment_reviews_open_idx ON self_build_payment_reviews(created_at)
  WHERE review_status='open';
COMMENT ON TABLE self_build_payment_reviews IS
  'Manual refund and late-provider-payment reconciliation ONLY. Documented != gateway refunded.';

CREATE FUNCTION queue_self_build_payment_reviews() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM self_build_order_snapshots WHERE order_id=NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.status='cancelled' AND NEW.payment_status IN ('paid','verified') THEN
    IF OLD.status<>'cancelled' THEN
      INSERT INTO self_build_payment_reviews(order_id,reason)
      VALUES(NEW.id,'PAID_ORDER_CANCELLED')
      ON CONFLICT(order_id,reason) DO NOTHING;
    END IF;
    IF OLD.status='cancelled' AND OLD.payment_status NOT IN ('paid','verified') THEN
      INSERT INTO self_build_payment_reviews(order_id,reason)
      VALUES(NEW.id,'LATE_PAYMENT_AFTER_CANCELLATION')
      ON CONFLICT(order_id,reason) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_self_build_payment_reviews_after_order_change
AFTER UPDATE OF status,payment_status ON orders
FOR EACH ROW
WHEN(OLD.status IS DISTINCT FROM NEW.status OR
     OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION queue_self_build_payment_reviews();

-- Leave current store checkout gate (customer_enabled=false) and both
-- checkout/webhook inventory modules completely UNCHANGED.
