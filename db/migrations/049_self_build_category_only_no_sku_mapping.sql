-- Owner's final Phase 3 decision (13 October 2026):
-- Self-build hamper buyers choose CATEGORIES and quantities, NOT catalogue SKUs.
-- Staff chooses the exact items within each chosen category during fulfilment.
-- This additive migration revises the staged self-build architecture only.
-- Live retail catalogue, prices, orders, stock and curated hampers are untouched.

-- This is intentionally fail-closed. If any admin attached a SKU or attempted
-- a catalogue-category link since migration 048, do NOT silently delete it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM self_build_catalog_product_rules) THEN
    RAISE EXCEPTION 'SELF_BUILD_SKU_RULES_EXIST_REVIEW_BEFORE_REMOVAL';
  END IF;
  IF EXISTS (SELECT 1 FROM self_build_categories WHERE catalog_category IS NOT NULL) THEN
    RAISE EXCEPTION 'SELF_BUILD_CATALOG_CATEGORY_MAPPING_EXISTS_REVIEW_BEFORE_REMOVAL';
  END IF;
END $$;

-- 'category' is a genuine selectable category with a DB-configured internal
-- cost per chosen unit. 'catalog' is no longer an allowed selection kind.
ALTER TABLE self_build_categories DROP CONSTRAINT self_build_categories_selection_kind_check;
ALTER TABLE self_build_categories
  ADD CONSTRAINT self_build_categories_selection_kind_check
  CHECK (selection_kind IN ('group', 'catalog', 'category', 'variant', 'photo', 'notes'));

-- Remove the OLD charge constraint before changing the kind: it only
-- recognizes 'catalog' and would reject the transition otherwise.
ALTER TABLE self_build_categories DROP CONSTRAINT self_build_categories_charge_semantics;

UPDATE self_build_categories
   SET selection_kind = 'category', updated_at = now()
 WHERE selection_kind = 'catalog';

ALTER TABLE self_build_categories DROP CONSTRAINT self_build_categories_selection_kind_check;
ALTER TABLE self_build_categories
  ADD CONSTRAINT self_build_categories_selection_kind_check
  CHECK (selection_kind IN ('group', 'category', 'variant', 'photo', 'notes'));

ALTER TABLE self_build_categories
  ADD CONSTRAINT self_build_categories_charge_semantics CHECK (
    (selection_kind IN ('group','notes') AND charge_mode = 'none' AND unit_budget_paise IS NULL)
    OR (selection_kind = 'category' AND charge_mode = 'per_unit' AND unit_budget_paise IS NOT NULL)
    OR (selection_kind = 'variant' AND charge_mode = 'option' AND unit_budget_paise IS NULL)
    OR (selection_kind = 'photo' AND charge_mode IN ('per_unit','once_per_category') AND unit_budget_paise IS NOT NULL)
  );

-- Retire unsupported SKU association structure. Staging had no live usage;
-- the explicit empty-data check above stops accidental loss of real mappings.
DROP TABLE self_build_catalog_product_rules;
ALTER TABLE self_build_categories DROP COLUMN catalog_category;

-- Old admin configuration snapshots must fail optimistic-version checks.
UPDATE self_build_configuration SET version = version + 1, updated_at = now()
 WHERE id = 'primary';

-- Feature remains disabled at the DATABASE level. No payment/order activation.
