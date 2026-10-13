-- Add order-scoped, two-way customer chat without modifying existing support rows.
-- Transactional outbox ensures a customer message is never committed without a queued owner alert.
ALTER TABLE telegram_order_messages
  DROP CONSTRAINT IF EXISTS telegram_order_messages_sender_check;
ALTER TABLE telegram_order_messages
  ADD CONSTRAINT telegram_order_messages_sender_check
    CHECK (sender IN ('celebration_support', 'customer'));

ALTER TABLE telegram_order_messages
  ALTER COLUMN telegram_update_id DROP NOT NULL,
  ALTER COLUMN telegram_message_id DROP NOT NULL,
  ALTER COLUMN reply_to_telegram_message_id DROP NOT NULL;
ALTER TABLE telegram_order_messages
  ADD COLUMN client_message_id uuid UNIQUE;
ALTER TABLE telegram_order_messages
  ADD CONSTRAINT telegram_order_messages_origin_check CHECK (
    (sender='celebration_support' AND telegram_update_id IS NOT NULL
       AND telegram_message_id IS NOT NULL AND reply_to_telegram_message_id IS NOT NULL
       AND client_message_id IS NULL)
    OR
    (sender='customer' AND telegram_update_id IS NULL
       AND telegram_message_id IS NULL AND reply_to_telegram_message_id IS NULL
       AND client_message_id IS NOT NULL)
  );

ALTER TABLE telegram_notification_outbox
  DROP CONSTRAINT IF EXISTS telegram_notification_outbox_source_check;
ALTER TABLE telegram_notification_outbox
  ADD CONSTRAINT telegram_notification_outbox_source_check
    CHECK (source IN ('order_event','payment_event','payment_status','customer_message'));

CREATE FUNCTION telegram_queue_customer_message() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO telegram_notification_outbox
    (order_id, source, source_event_id, event_type, payload)
  VALUES (NEW.order_id, 'customer_message', NEW.id::text,
          'customer_message', jsonb_build_object('body',NEW.body))
  ON CONFLICT (source, source_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER telegram_from_customer_messages
AFTER INSERT ON telegram_order_messages FOR EACH ROW
WHEN (NEW.sender = 'customer')
EXECUTE FUNCTION telegram_queue_customer_message();

CREATE INDEX telegram_order_messages_unread_support_idx
  ON telegram_order_messages (order_id, sent_at DESC)
  WHERE sender = 'celebration_support' AND read_at IS NULL;
