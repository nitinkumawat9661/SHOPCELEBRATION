-- Set the 22 approved Celebration necklaces to ₹149 sale price with an exact 20% discount.
-- ₹149 / 0.80 = ₹186.25 MRP. Delivery is included in the ₹149 selling price.
WITH transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           COALESCE((
             SELECT jsonb_agg(
               CASE
                 WHEN product->>'id' ~ '^celebration-necklace-(00[1-9]|01[0-9]|02[0-2])$'
                 THEN jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(product, '{salePricePaise}', '14900'::jsonb, true),
                            '{badge}', to_jsonb('20% OFF'::text), true
                          ),
                          '{retail,mrpPaise}', '18625'::jsonb, true
                        ),
                        '{retail,unitSalePrice}', to_jsonb('₹149 per piece, delivery included'::text), true
                      )
                 ELSE product
               END
               ORDER BY ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb)) WITH ORDINALITY AS p(product, ordinality)
           ), '[]'::jsonb),
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
