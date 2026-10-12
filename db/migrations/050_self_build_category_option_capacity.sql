-- Phase 3 admin workspace: optional category/option fulfilment capacity.
-- Capacity is an owner's operational planning figure, NOT a stock reservation,
-- retail jewellery SKU mapping, public availability promise, or live checkout.
-- Existing categories remain UNCONFIRMED until owner verifies physical supply.

ALTER TABLE self_build_categories
  ADD COLUMN availability_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN available_units integer NULL,
  ADD CONSTRAINT self_build_categories_capacity_valid CHECK (
    (availability_confirmed = false AND available_units IS NULL)
    OR (availability_confirmed = true AND available_units IS NOT NULL
        AND available_units >= 0 AND available_units <= 1000000)
  );

ALTER TABLE self_build_options
  ADD COLUMN availability_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN available_units integer NULL,
  ADD CONSTRAINT self_build_options_capacity_valid CHECK (
    (availability_confirmed = false AND available_units IS NULL)
    OR (availability_confirmed = true AND available_units IS NOT NULL
        AND available_units >= 0 AND available_units <= 1000000)
  );

-- NOTE: Counts are category/pack-level only. They do not automatically decrement
-- on orders, as no self-build order path is enabled. Transactional reservation
-- and release must be implemented before a buyer-facing flow launches.
UPDATE self_build_configuration SET version = version + 1, updated_at = now()
WHERE id = 'primary';
