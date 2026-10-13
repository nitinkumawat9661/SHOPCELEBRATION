-- Opt-in, bounded courier watcher scheduling. Never modifies shipment or payment.
CREATE TABLE telegram_courier_poll_state (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_courier_poll_state_last_checked_idx
  ON telegram_courier_poll_state (last_checked_at);
