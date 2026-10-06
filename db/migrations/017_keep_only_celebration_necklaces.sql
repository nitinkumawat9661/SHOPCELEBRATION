-- Keep only the 22 approved Celebration necklaces in the live catalog.
-- Also discard any stale admin draft that could reintroduce removed products.
WITH filtered AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           COALESCE((
             SELECT jsonb_agg(product ORDER BY product->>'id')
             FROM jsonb_array_elements(COALESCE(cc.payload->'products', '[]'::jsonb)) AS product
             WHERE product->>'id' ~ '^celebration-necklace-(00[1-9]|01[0-9]|02[0-2])$'
           ), '[]'::jsonb),
           true
         ) AS payload
  FROM catalog_config cc
  WHERE cc.id = 'primary'
),
updated AS (
  UPDATE catalog_config cc
     SET payload = filtered.payload,
         version = cc.version + 1,
         updated_at = now()
    FROM filtered
   WHERE cc.id = filtered.id
  RETURNING cc.version, cc.payload
)
INSERT INTO catalog_revisions (version, payload)
SELECT version, payload FROM updated;

DELETE FROM catalog_drafts WHERE id = 'primary';
