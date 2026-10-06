-- Add the published 6-month anti-tarnish guarantee to the 22 approved Celebration necklaces.
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
                   product,
                   '{retail,warrantyOrGuarantee}',
                   to_jsonb('6-month anti-tarnish guarantee from delivery date for verified tarnish under normal personal use, subject to published care, exclusions and claim-verification terms.'::text),
                   true
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
