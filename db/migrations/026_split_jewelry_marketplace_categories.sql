-- Split the live jewelry catalog into three storefront categories.
-- Marketplace filters read category values dynamically from the DB, so future categories appear automatically.
WITH transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN p.product->>'id' ~ '^celebration-necklace-(00[1-9]|01[0-9]|02[0-2])$'
                   THEN jsonb_set(p.product, '{category}', to_jsonb('Premium Anti-Tarnish Necklaces'::text), true)
                 WHEN p.product->>'id' ~ '^celebration-set-(00[1-9]|01[0-5])$'
                   THEN jsonb_set(p.product, '{category}', to_jsonb('Necklace + Earrings Sets'::text), true)
                 WHEN p.product->>'id' ~ '^celebration-necklace-(02[3-9]|03[0-9]|04[0-9]|050)$'
                   THEN jsonb_set(p.product, '{category}', to_jsonb('Trending Necklaces'::text), true)
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
