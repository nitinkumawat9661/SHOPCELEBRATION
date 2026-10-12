-- Account-owned favourites: no phone, address or customer details are exposed.
-- Never trust an account ID supplied by a client; resolve the verified session.
CREATE TABLE IF NOT EXISTS customer_wishlist (
  account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  product_id text NOT NULL CHECK (product_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, product_id)
);
CREATE INDEX IF NOT EXISTS customer_wishlist_account_recent_idx
  ON customer_wishlist (account_id, created_at DESC, product_id);
