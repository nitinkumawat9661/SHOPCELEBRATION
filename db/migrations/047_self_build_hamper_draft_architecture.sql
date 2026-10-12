-- Phase 3 staging architecture ONLY. No storefront, checkout, order payment or inventory
-- reservations are wired to these tables. The customer-facing feature is hard-gated
-- OFF in the DB until an explicit later reviewed migration changes the contract.
-- Costs below are PRIVATE INTERNAL HAMPER BUDGET CONSUMPTION in paise, NOT
-- jewellery retail prices and must never be exposed through a public endpoint.

CREATE TABLE self_build_configuration (
  id text PRIMARY KEY DEFAULT 'primary' CHECK (id = 'primary'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  customer_enabled boolean NOT NULL DEFAULT false CHECK (customer_enabled = false),
  show_item_prices boolean NOT NULL DEFAULT false CHECK (show_item_prices = false),
  allow_multiple_quantities boolean NOT NULL DEFAULT true,
  default_catalog_item_budget_paise integer NOT NULL CHECK (default_catalog_item_budget_paise >= 0 AND default_catalog_item_budget_paise <= 2147483647),
  other_request_prompt text NOT NULL CHECK (char_length(other_request_prompt) BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE self_build_categories (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  parent_id text NULL REFERENCES self_build_categories(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  -- Admin must explicitly associate real catalogue category/individual SKU.
  -- This does not invent 7 jewellery categories from the 5 currently listed.
  catalog_category text NULL CHECK (catalog_category IS NULL OR char_length(catalog_category) BETWEEN 1 AND 100),
  selection_kind text NOT NULL CHECK (selection_kind IN ('group','catalog','variant','photo','notes')),
  charge_mode text NOT NULL CHECK (charge_mode IN ('none','per_unit','once_per_category','option')),
  unit_budget_paise integer NULL CHECK (unit_budget_paise IS NULL OR (unit_budget_paise >= 0 AND unit_budget_paise <= 2147483647)),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_build_categories_not_own_parent CHECK (parent_id IS DISTINCT FROM id),
  CONSTRAINT self_build_categories_charge_semantics CHECK (
    (selection_kind IN ('group','notes') AND charge_mode = 'none' AND unit_budget_paise IS NULL)
    OR (selection_kind = 'catalog' AND charge_mode = 'per_unit')
    OR (selection_kind = 'variant' AND charge_mode = 'option' AND unit_budget_paise IS NULL)
    OR (selection_kind = 'photo' AND charge_mode = 'once_per_category' AND unit_budget_paise IS NOT NULL)
  )
);
CREATE INDEX self_build_categories_parent_idx ON self_build_categories (parent_id, display_order, id);

CREATE TABLE self_build_options (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  category_id text NOT NULL REFERENCES self_build_categories(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  -- OPTIONS are budget consumption values, NOT visible per-item prices.
  unit_budget_paise integer NOT NULL CHECK (unit_budget_paise >= 0 AND unit_budget_paise <= 2147483647),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_build_options_id_category_unique UNIQUE (id, category_id)
);
CREATE INDEX self_build_options_category_idx ON self_build_options (category_id, display_order, id);

-- SKU mapping is EXPLICIT: no inference from names/images/marketing labels.
-- A stylish-bangle SKU can remain in its source jewellery section but consume
-- the ₹150 internal bangle amount through unit_budget_paise override.
CREATE TABLE self_build_catalog_product_rules (
  category_id text NOT NULL REFERENCES self_build_categories(id) ON DELETE RESTRICT,
  product_id text NOT NULL CHECK (product_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'),
  unit_budget_paise integer NULL CHECK (unit_budget_paise IS NULL OR (unit_budget_paise >= 0 AND unit_budget_paise <= 2147483647)),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, product_id)
);
CREATE INDEX self_build_catalog_product_rules_product_idx
  ON self_build_catalog_product_rules (product_id, category_id);

-- Schema prepares account-scoped autosave only; application does not write to
-- these tables yet. JSON arrays are draft selections, never trusted quotations.
CREATE TABLE self_build_drafts (
  id text PRIMARY KEY,
  customer_account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  tier_id text NOT NULL CHECK (char_length(tier_id) BETWEEN 1 AND 40),
  selections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(selections) = 'array'),
  other_request_text text NOT NULL DEFAULT '' CHECK (char_length(other_request_text) <= 1200),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX self_build_drafts_account_idx
  ON self_build_drafts (customer_account_id, updated_at DESC);
CREATE INDEX self_build_drafts_expiry_idx ON self_build_drafts (expires_at);

-- Immutable order-level snapshot slot, not a live reservation or verified BOM.
-- Future transactional checkout must validate stock, price, pack size,
-- freeze components and reserve inventory BEFORE writing this record.
CREATE TABLE self_build_order_snapshots (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  rules_version integer NOT NULL CHECK (rules_version > 0),
  tier_id text NOT NULL CHECK (char_length(tier_id) BETWEEN 1 AND 40),
  selections jsonb NOT NULL CHECK (jsonb_typeof(selections) = 'array'),
  total_internal_budget_paise integer NOT NULL CHECK (total_internal_budget_paise >= 0),
  tier_budget_paise integer NOT NULL CHECK (tier_budget_paise >= 0),
  other_request_text text NOT NULL DEFAULT '' CHECK (char_length(other_request_text) <= 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_build_budget_within_tier CHECK (total_internal_budget_paise <= tier_budget_paise)
);

-- Seed ONLY unambiguous owner-provided rules. Runtime code reads DB and
-- admin can revise any amount/label/order later without deployment.
INSERT INTO self_build_configuration
  (id, default_catalog_item_budget_paise, other_request_prompt)
VALUES
  ('primary', 6000, 'Need anything else? Describe it here. Our team will discuss your request with you.');

INSERT INTO self_build_categories
  (id, parent_id, label, catalog_category, selection_kind, charge_mode, unit_budget_paise, display_order)
VALUES
  ('jewellery', NULL, 'Jewellery', NULL, 'group', 'none', NULL, 10),
  ('bangles', NULL, 'Bangles', NULL, 'catalog', 'per_unit', 15000, 20),
  ('chocolates', NULL, 'Chocolates', NULL, 'variant', 'option', NULL, 30),
  ('snacks', NULL, 'Snacks', NULL, 'variant', 'option', NULL, 40),
  ('perfume', NULL, 'Perfume', NULL, 'variant', 'option', NULL, 50),
  ('personalised-photos', NULL, 'Personalised Photos', NULL, 'photo', 'once_per_category', 5000, 60),
  ('anything-else', NULL, 'Anything Else?', NULL, 'notes', 'none', NULL, 70);

-- Mini ₹200, Medium ₹400, Large ₹400 and Mega ₹1,000: keep both Medium
-- and Large at the SAME ₹400, exactly as specified.
INSERT INTO self_build_options
  (id, category_id, label, unit_budget_paise, display_order)
VALUES
  ('chocolate-mini', 'chocolates', 'Mini', 20000, 20),
  ('chocolate-medium', 'chocolates', 'Medium', 40000, 30),
  ('chocolate-large', 'chocolates', 'Large', 40000, 40),
  ('chocolate-mega', 'chocolates', 'Mega', 100000, 50),
  ('snack-mini', 'snacks', 'Mini', 20000, 20),
  ('snack-medium', 'snacks', 'Medium', 40000, 30),
  ('snack-large', 'snacks', 'Large', 40000, 40),
  ('snack-mega', 'snacks', 'Mega', 100000, 50),
  ('perfume-mini', 'perfume', 'Mini', 20000, 20),
  ('perfume-medium', 'perfume', 'Medium', 40000, 30),
  ('perfume-large', 'perfume', 'Large', 40000, 40),
  ('perfume-mega', 'perfume', 'Mega', 100000, 50);

-- Owner specified an additional ₹100 CHOCOLATE choice without a display NAME.
-- Stage it disabled so no invented "Small"/"Starter" label becomes customer copy.
INSERT INTO self_build_options
  (id, category_id, label, unit_budget_paise, display_order, active)
VALUES
  ('chocolate-extra-100', 'chocolates', 'Name pending owner confirmation', 10000, 10, false);

-- Do not seed 7 purported jewellery categories or map "stylish" bangle SKUs:
-- checked-in catalogue has 5 actual categories and no definitive 7-label
-- mapping. Admin must supply/verify these category and product IDs first.
-- No synthetic chocolate/snack/perfume SKUs or fake stock are created.
