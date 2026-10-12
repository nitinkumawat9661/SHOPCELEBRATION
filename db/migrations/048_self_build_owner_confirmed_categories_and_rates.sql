-- Owner-confirmed Phase 3 self-build rules (2026-10-13).
-- Supersedes initial staging values in 047 WITHOUT editing an applied migration.
-- These are PRIVATE, admin-editable internal budget-consumption amounts in paise.
-- Do not change existing catalogue retail prices, live customer orders or stock.
-- Customer self-build and item-price display stay hard-disabled by migration 047.

-- Photo choices now consume ₹50 PER PHOTO rather than once for the whole set.
-- Keep photo charge mode editable in the restricted admin architecture, while
-- the seeded rule is per_unit. A future pricing service must multiply quantity.
ALTER TABLE self_build_categories DROP CONSTRAINT self_build_categories_charge_semantics;
ALTER TABLE self_build_categories ADD CONSTRAINT self_build_categories_charge_semantics CHECK (
  (selection_kind IN ('group','notes') AND charge_mode = 'none' AND unit_budget_paise IS NULL)
  OR (selection_kind = 'catalog' AND charge_mode = 'per_unit')
  OR (selection_kind = 'variant' AND charge_mode = 'option' AND unit_budget_paise IS NULL)
  OR (selection_kind = 'photo' AND charge_mode IN ('per_unit','once_per_category') AND unit_budget_paise IS NOT NULL)
);

UPDATE self_build_categories
   SET charge_mode = 'per_unit', unit_budget_paise = 5000, updated_at = now()
 WHERE id = 'personalised-photos' AND selection_kind = 'photo';

-- The existing top-level standalone Bangles category remains unchanged at
-- ₹150 per item. Here we add ALL EIGHT explicitly named jewellery subcategories.
-- SOURCE SKU/category mapping is intentionally NULL: existing catalogue has
-- five unrelated marketing group labels and no definitive item-level mapping.
-- Every category is administrable without redeploy; never infer membership
-- from a name, a photograph, or an unverified product-angle.
INSERT INTO self_build_categories
  (id, parent_id, label, catalog_category, selection_kind, charge_mode,
   unit_budget_paise, display_order, active)
VALUES
  ('premium-feature-necklaces', 'jewellery', 'Premium Feature Necklaces', NULL, 'catalog', 'per_unit', 6000, 10, true),
  ('premium-necklaces', 'jewellery', 'Premium Necklaces', NULL, 'catalog', 'per_unit', 6000, 20, true),
  ('necklace-stud-sets', 'jewellery', 'Necklace & Stud Sets', NULL, 'catalog', 'per_unit', 6000, 30, true),
  ('korean-earrings', 'jewellery', 'Korean Earrings', NULL, 'catalog', 'per_unit', 6000, 40, true),
  ('indian-trending-earrings', 'jewellery', 'Indian Trending Earrings', NULL, 'catalog', 'per_unit', 6000, 50, true),
  ('minimal-rings', 'jewellery', 'Minimal Rings', NULL, 'catalog', 'per_unit', 6000, 60, true),
  ('viral-bangles', 'jewellery', 'Viral Bangles', NULL, 'catalog', 'per_unit', 15000, 70, true),
  ('korean-bangles', 'jewellery', 'Korean Bangles', NULL, 'catalog', 'per_unit', 15000, 80, true)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  label = EXCLUDED.label,
  catalog_category = EXCLUDED.catalog_category,
  selection_kind = EXCLUDED.selection_kind,
  charge_mode = EXCLUDED.charge_mode,
  unit_budget_paise = EXCLUDED.unit_budget_paise,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active,
  updated_at = now();

-- Mini ₹200; Medium ₹400; Large ₹600; Mega ₹1,000 across ALL 3 groups.
-- Medium remains ₹400. Large was previously seeded as ₹400 and is revised.
UPDATE self_build_options
   SET unit_budget_paise = 60000, updated_at = now()
 WHERE id IN ('chocolate-large', 'snack-large', 'perfume-large')
   AND category_id IN ('chocolates', 'snacks', 'perfume');

-- Customer-facing name now confirmed: Chocolate Starter ₹100.
UPDATE self_build_options
   SET label = 'Starter', unit_budget_paise = 10000, active = true, updated_at = now()
 WHERE id = 'chocolate-extra-100' AND category_id = 'chocolates';

-- Invalidate stale admin settings copies, preserving all admin controls.
UPDATE self_build_configuration
   SET version = version + 1, updated_at = now()
 WHERE id = 'primary';

-- No product mappings are inserted. No synthetic earrings, chocolates,
-- snacks, perfumes or bangle stock is fabricated. Safe customer-mode OFF.
