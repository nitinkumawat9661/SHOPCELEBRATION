-- Celebration: durable, transactional Telegram notification outbox.
-- Only NEW order/payment events are queued after this migration.
-- Applying the migration never contacts Telegram or changes existing order/payment rows.
CREATE TABLE telegram_notification_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('order_event', 'payment_event')),
  source_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  telegram_message_id bigint,
  last_error text,
  CONSTRAINT telegram_notification_source_once UNIQUE (source, source_event_id)
);

CREATE INDEX telegram_notification_outbox_pending_idx
  ON telegram_notification_outbox (next_attempt_at, id)
  WHERE sent_at IS NULL;

CREATE FUNCTION enqueue_telegram_notification() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO telegram_notification_outbox
    (order_id, source, source_event_id, event_type, payload)
  VALUES
    (NEW.order_id, TG_ARGV[0], NEW.id, NEW.event_type,
     COALESCE(NEW.payload, '{}'::jsonb))
  ON CONFLICT (source, source_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER telegram_from_order_events
AFTER INSERT ON order_events FOR EACH ROW
EXECUTE FUNCTION enqueue_telegram_notification('order_event');

CREATE TRIGGER telegram_from_payment_events
AFTER INSERT ON payment_events FOR EACH ROW
EXECUTE FUNCTION enqueue_telegram_notification('payment_event');
