-- Celebration owner's self-build budget policy, 13 Oct 2026.
-- NO INVENTORY, SKUs, reserved units, retail pricing or buyer launch flags.
-- Standard/mini through ₹999: target 80% of published hamper price.
-- Large/Grand ₹1,299 and above: target 75% of published hamper price.
-- Checkout independently allows at most +5 percentage points for a final
-- category choice, with the absolute cap checked from the CURRENT catalog.
-- All values are paise and PRIVATE. Customer sees only tier retail price
-- and existing per-tier maxChoices (repeat quantity counts as separate items).
CREATE OR REPLACE FUNCTION refresh_self_build_tier_budget_targets(published jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(published->'tiers') <> 'array'
    THEN RAISE EXCEPTION 'SELF_BUILD_PUBLISHED_TIERS_INVALID'; END IF;
  INSERT INTO self_build_tier_allowances(tier_id,allowance_paise,enabled)
  SELECT t->>'id',
    FLOOR((t->>'price')::numeric *
      CASE WHEN (t->>'price')::numeric >= 1299 THEN 75 ELSE 80 END)::integer,
    COALESCE(t->>'active','true') <> 'false'
  FROM jsonb_array_elements(published->'tiers') t
  WHERE jsonb_typeof(t)='object'
    AND t ? 'id' AND t ? 'price'
  ON CONFLICT(tier_id) DO UPDATE SET
    allowance_paise=EXCLUDED.allowance_paise,
    enabled=EXCLUDED.enabled,
    updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION self_build_catalog_budget_targets_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id='primary' THEN
    PERFORM refresh_self_build_tier_budget_targets(NEW.payload);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sync_self_build_targets_after_catalog_publish
AFTER INSERT OR UPDATE OF payload ON catalog_config
FOR EACH ROW EXECUTE FUNCTION self_build_catalog_budget_targets_trigger();

-- Apply now to the published catalog WITHOUT touching catalog_config itself.
SELECT refresh_self_build_tier_budget_targets(payload)
FROM catalog_config WHERE id='primary';
