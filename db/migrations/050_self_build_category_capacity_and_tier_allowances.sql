-- Phase 3.3 staged category-level fulfilment capacity and 3.4 tier budget allowances.
-- NO catalogue SKUs, NO fake available units, NO new customer checkout.
-- Zero availability and no tier allowance are the safe defaults.
-- Private fields must only be read through authenticated admin/server code.

CREATE TABLE self_build_category_capacity (
  category_id text PRIMARY KEY REFERENCES self_build_categories(id) ON DELETE CASCADE,
  available_units integer NOT NULL DEFAULT 0 CHECK (available_units BETWEEN 0 AND 1000000),
  reserved_units integer NOT NULL DEFAULT 0 CHECK (reserved_units BETWEEN 0 AND available_units),
  verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE self_build_option_capacity (
  option_id text PRIMARY KEY REFERENCES self_build_options(id) ON DELETE CASCADE,
  available_units integer NOT NULL DEFAULT 0 CHECK (available_units BETWEEN 0 AND 1000000),
  reserved_units integer NOT NULL DEFAULT 0 CHECK (reserved_units BETWEEN 0 AND available_units),
  verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- These budgets are privately configured allowances, NOT the catalogue tier's
-- advertised selling price. A missing/disabled allowance blocks quotations.
-- Tier IDs live in versioned catalog JSON, so validated by server, not FK.
CREATE TABLE self_build_tier_allowances (
  tier_id text PRIMARY KEY CHECK (tier_id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  allowance_paise integer NOT NULL DEFAULT 0 CHECK (allowance_paise BETWEEN 0 AND 2147483647),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE self_build_capacity_control (
  id text PRIMARY KEY DEFAULT 'primary' CHECK (id='primary'),
  version integer NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 2147483647),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO self_build_capacity_control (id) VALUES ('primary');

-- Do not seed fictitious quantities, promises, packaging limits or allowance
-- budgets. All buyer-facing checkout flags remain off in migration 047.
