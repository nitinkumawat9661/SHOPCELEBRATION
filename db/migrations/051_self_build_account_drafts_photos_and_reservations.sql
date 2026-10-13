-- Self-Build: dormant account draft, private photo metadata, and
-- transactional category/option reservation ledger. NOT a checkout release.
-- Applied AFTER migrations 047..050. Retail SKU reservations untouched.

-- One durable draft per verified customer. Existing draft rows are staging-only;
-- fail rather than silently merge/delete any duplicates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM self_build_drafts GROUP BY customer_account_id HAVING COUNT(*) > 1)
  THEN RAISE EXCEPTION 'SELF_BUILD_DRAFTS_HAVE_DUPLICATE_ACCOUNTS'; END IF;
END $$;
CREATE UNIQUE INDEX self_build_drafts_one_per_account ON self_build_drafts(customer_account_id);

CREATE TABLE self_build_draft_photos (
  id uuid PRIMARY KEY,
  draft_id text NOT NULL REFERENCES self_build_drafts(id) ON DELETE CASCADE,
  customer_account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE CHECK (object_key ~ '^self-build/private/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  image_bytes integer NOT NULL CHECK (image_bytes BETWEEN 1 AND 3145728),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX self_build_draft_photos_owner_idx ON self_build_draft_photos(customer_account_id,draft_id,created_at);

-- One order reservation entry per chosen category/option; *no product IDs*.
-- Exactly one ledger per order protects retry idempotency.
CREATE TABLE self_build_order_reservation_batches (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved'
    CHECK(status IN ('reserved','committed','released')),
  rules_version integer NOT NULL CHECK(rules_version > 0),
  capacity_version integer NOT NULL CHECK(capacity_version > 0),
  tier_id text NOT NULL CHECK(tier_id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  internal_spent_paise integer NOT NULL CHECK(internal_spent_paise BETWEEN 0 AND 2147483647),
  tier_allowance_paise integer NOT NULL CHECK(tier_allowance_paise BETWEEN 0 AND 2147483647),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_build_reservation_budget_check CHECK(internal_spent_paise<=tier_allowance_paise)
);
CREATE INDEX self_build_reservation_expiry_idx ON self_build_order_reservation_batches(status,expires_at)
WHERE status='reserved';

CREATE TABLE self_build_order_reservation_items (
  order_id text NOT NULL REFERENCES self_build_order_reservation_batches(order_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('category','option')),
  choice_id text NOT NULL CHECK(choice_id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  PRIMARY KEY(order_id,kind,choice_id)
);

-- No stock inserted; no legacy orders mutated; no customer_enabled migration.
