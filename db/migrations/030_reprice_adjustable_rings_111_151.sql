-- Reprice the 12 Celebration adjustable rings into the ₹111–₹151 website range.
-- Preserve relative design tiers from the original ring pricing.
WITH price_map(product_id, sale_price_paise, badge, unit_sale_price) AS (
  VALUES
    ('celebration-ring-001', 15100, '24% OFF', '₹151 per piece, delivery included'),
    ('celebration-ring-002', 13900, '30% OFF', '₹139 per piece, delivery included'),
    ('celebration-ring-003', 12900, '35% OFF', '₹129 per piece, delivery included'),
    ('celebration-ring-004', 13900, '30% OFF', '₹139 per piece, delivery included'),
    ('celebration-ring-005', 13900, '30% OFF', '₹139 per piece, delivery included'),
    ('celebration-ring-006', 15100, '24% OFF', '₹151 per piece, delivery included'),
    ('celebration-ring-007', 12900, '35% OFF', '₹129 per piece, delivery included'),
    ('celebration-ring-008', 11100, '44% OFF', '₹111 per piece, delivery included'),
    ('celebration-ring-009', 12900, '35% OFF', '₹129 per piece, delivery included'),
    ('celebration-ring-010', 13900, '30% OFF', '₹139 per piece, delivery included'),
    ('celebration-ring-011', 12900, '35% OFF', '₹129 per piece, delivery included'),
    ('celebration-ring-012', 11100, '44% OFF', '₹111 per piece, delivery included')
),
transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN pm.product_id IS NULL THEN p.product
                 ELSE jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            p.product,
                            '{salePricePaise}',
                            to_jsonb(pm.sale_price_paise),
                            true
                          ),
                          '{badge}',
                          to_jsonb(pm.badge),
                          true
                        ),
                        '{retail,unitSalePrice}',
                        to_jsonb(pm.unit_sale_price),
                        true
                      )
               END
               ORDER BY p.ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb))
                  WITH ORDINALITY AS p(product, ordinality)
             LEFT JOIN price_map pm ON pm.product_id = p.product->>'id'
           ),
           true
         ) AS payload
  FROM catalog_config cc
  WHERE cc.id = 'primary'
),
updated AS (
  UPDATE catalog_config cc
     SET payload = transformed.payload,
         version = cc.version + 1,
         updated_at = now()
    FROM transformed
   WHERE cc.id = transformed.id
  RETURNING cc.version, cc.payload
)
INSERT INTO catalog_revisions (version, payload)
SELECT version, payload FROM updated;

DELETE FROM catalog_drafts WHERE id = 'primary';
