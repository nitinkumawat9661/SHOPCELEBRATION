-- Telegram backend additions. Additive only: no existing order, payment, or stock rows changed.
-- Apply ONLY after migration 050, with the normal transactional migration runner.

ALTER TABLE telegram_notification_outbox
  ADD COLUMN snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Record event-time order/payment facts instead of reading only the latest order
-- state when an old queued notification is eventually delivered.
CREATE OR REPLACE FUNCTION enqueue_telegram_notification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE facts jsonb;
BEGIN
  SELECT jsonb_build_object(
    'status', o.status,
    'paymentStatus', o.payment_status,
    'paymentProvider', o.payment_provider,
    'paidAt', o.paid_at,
    'amountPaise', o.amount_paise,
    'subtotalPaise', o.subtotal_paise,
    'discountPaise', o.discount_paise,
    'shippingPaise', o.shipping_paise,
    'shippingProvider', o.shipping_provider,
    'trackingNumber', o.shipping_tracking_number
  ) INTO facts
  FROM orders o WHERE o.id = NEW.order_id;

  INSERT INTO telegram_notification_outbox
    (order_id, source, source_event_id, event_type, payload, snapshot)
  VALUES
    (NEW.order_id, TG_ARGV[0], NEW.id, NEW.event_type,
     COALESCE(NEW.payload, '{}'::jsonb), COALESCE(facts, '{}'::jsonb))
  ON CONFLICT (source, source_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Capture payment changes directly into the NEW Telegram outbox; do not
-- insert an unfamiliar event type into the existing order_events timeline.
-- Retain compatibility if migration 050 has already been applied elsewhere.
ALTER TABLE telegram_notification_outbox
  DROP CONSTRAINT IF EXISTS telegram_notification_outbox_source_check;
ALTER TABLE telegram_notification_outbox
  ADD CONSTRAINT telegram_notification_outbox_source_check
  CHECK (source IN ('order_event','payment_event','payment_status'));

CREATE FUNCTION telegram_record_payment_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO telegram_notification_outbox
    (order_id, source, source_event_id, event_type, payload, snapshot)
  VALUES (
    NEW.id, 'payment_status', gen_random_uuid(), 'payment_status_changed',
    jsonb_build_object(
      'from', OLD.payment_status,
      'to', NEW.payment_status,
      'provider', NEW.payment_provider,
      'amountPaise', NEW.amount_paise
    ),
    jsonb_build_object(
      'status', NEW.status, 'paymentStatus', NEW.payment_status,
      'paymentProvider', NEW.payment_provider, 'paidAt', NEW.paid_at,
      'amountPaise', NEW.amount_paise, 'subtotalPaise', NEW.subtotal_paise,
      'discountPaise', NEW.discount_paise, 'shippingPaise', NEW.shipping_paise,
      'shippingProvider', NEW.shipping_provider,
      'trackingNumber', NEW.shipping_tracking_number
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER telegram_on_payment_status_change
AFTER UPDATE OF payment_status ON orders
FOR EACH ROW
WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION telegram_record_payment_change();

-- Telegram admin replies bound to the original order, never to a typed order ID.
CREATE TABLE telegram_order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'celebration_support' CHECK (sender = 'celebration_support'),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  telegram_update_id bigint NOT NULL UNIQUE,
  telegram_message_id bigint NOT NULL UNIQUE,
  reply_to_telegram_message_id bigint NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX telegram_order_messages_order_idx
  ON telegram_order_messages (order_id, sent_at DESC);

-- Deduplicate actual Shipway observations (code + provider scan timestamp).
-- New observations also create normal order_events and use the same outbox.
CREATE TABLE order_courier_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  provider text NOT NULL,
  code text NOT NULL,
  stage text NOT NULL,
  label text NOT NULL,
  location text,
  scan_occurred_at text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, fingerprint)
);
CREATE INDEX order_courier_observations_order_idx
  ON order_courier_observations (order_id, observed_at DESC);
