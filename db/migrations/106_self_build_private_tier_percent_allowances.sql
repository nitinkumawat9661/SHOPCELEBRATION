-- Owner-approved Self-Build private tier budgets only. NO inventory/stock changes.
-- Smaller tiers: target 80%, allowed +/-5 percentage points; larger
-- premium hampers priced >= INR 1999: target 75%, allowed +/-5 points.
-- Persist the *maximum permissible* allowance (85% / 80%). Items under
-- that ceiling are allowed, including selections below the nominal target.
-- Retail hamper pricing is unchanged. Buyer hard gate stays OFF.
-- Deployment with a yet-unseeded catalog simply has no tiers to update.
-- Published production tiers are already present; test fixtures may seed later.
WITH active_tiers AS (
  SELECT (t->>'id')::text tier_id, (t->>'price')::numeric selling_rupees
  FROM catalog_config c, LATERAL jsonb_array_elements(c.payload->'tiers') t
  WHERE c.id='primary' AND (t->>'active' IS NULL OR t->>'active'<>'false')
), policy AS (
  SELECT tier_id,
    floor(selling_rupees * 100 * CASE WHEN selling_rupees>=1999
      THEN 0.80 ELSE 0.85 END)::integer AS maximum_internal_paise
  FROM active_tiers WHERE selling_rupees>0
)
INSERT INTO self_build_tier_allowances (tier_id,allowance_paise,enabled)
SELECT tier_id,maximum_internal_paise,true FROM policy
ON CONFLICT (tier_id) DO UPDATE
  SET allowance_paise=EXCLUDED.allowance_paise,
      enabled=true,updated_at=now();

-- The owner expressly allows multiple units of ONE category up to the
-- published per-tier piece maximum; do not create per-SKU stock restrictions.
UPDATE self_build_configuration
 SET allow_multiple_quantities=true,version=version+1,updated_at=now()
 WHERE id='primary' AND allow_multiple_quantities IS DISTINCT FROM true;

-- No touching category capacity, retail SKU inventory, physical quantities,
-- order reservations, account data, catalog tiers, or customerEnabled.
