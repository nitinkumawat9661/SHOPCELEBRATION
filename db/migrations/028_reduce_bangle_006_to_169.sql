-- Reduce celebration-bangle-006 from ₹199 to ₹169 while preserving the ₹399 MRP.
-- Update the displayed discount to the rounded actual 58% OFF.
WITH transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN p.product->>'id' = 'celebration-bangle-006'
                 THEN jsonb_set(
                        jsonb_set(
                          jsonb_set(p.product, '{salePricePaise}', '16900'::jsonb, true),
                          '{badge}', to_jsonb('58% OFF'::text), true
                        ),
                        '{retail,unitSalePrice}', to_jsonb('₹169 per piece, delivery included'::text), true
                      )
                 ELSE p.product
               END
               ORDER BY p.ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb))
                  WITH ORDINALITY AS p(product, ordinality)
           ),
           true
         ) AS payload
  FROM catalog_config cc
  WHERE cc.id='primary'
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

DELETE FROM catalog_drafts WHERE id='primary';
