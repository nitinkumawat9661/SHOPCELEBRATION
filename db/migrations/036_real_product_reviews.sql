-- Section 3: real customer reviews only; no synthetic or sample rows.
CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY,
  product_id text NOT NULL,
  customer_account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(id),
  reviewer_name text NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 80),
  reviewer_city text NOT NULL DEFAULT '' CHECK (char_length(reviewer_city) <= 90),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text NOT NULL CHECK (char_length(review_text) BETWEEN 15 AND 1200),
  photo_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT product_reviews_customer_product_uniq UNIQUE (customer_account_id, product_id),
  CONSTRAINT product_reviews_photo_key_unique UNIQUE (photo_key)
);
CREATE INDEX IF NOT EXISTS product_reviews_public_idx ON product_reviews (product_id, submitted_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS product_reviews_queue_idx ON product_reviews (status, submitted_at ASC);

-- Reviews must refer to a paid, actually delivered individual order that
-- includes this exact product SKU. Check this in the INSERT transaction too.
