-- Keep selling price unchanged at ₹149 and replace decimal MRP with a clean whole-rupee MRP.
-- ₹199 MRP -> ₹149 selling price; displayed discount rounds to 25%.
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
                        jsonb_set(product, '{badge}', to_jsonb('25% OFF'::text), true),
                        '{retail,mrpPaise}', '19900'::jsonb, true
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
