-- Remove duplicate ring designs and clean color words from ring product names.
-- Keep the canonical celebration-ring-* entry for each of the 12 ring images.
WITH canonical(product_id, image_url, product_name) AS (
  VALUES
    ('celebration-ring-001','https://upload.meeshosupplyassets.com/cataloging/1791402529853/CelebrationCrownRingJewelryAdvertisement.png','Korean Crown Adjustable Ring'),
    ('celebration-ring-002','https://upload.meeshosupplyassets.com/cataloging/1791402529656/CelebrationDouble-HeartRingAdvertisement.png','Korean Twin Heart Bypass Adjustable Ring'),
    ('celebration-ring-003','https://upload.meeshosupplyassets.com/cataloging/1791402529615/CelebrationHeartRingGiftBanner.png','Korean Open Heart Adjustable Ring'),
    ('celebration-ring-004','https://upload.meeshosupplyassets.com/cataloging/1791402529997/CelebrationRingFestiveJewelryAd.png','Korean Geometric Arc Adjustable Ring'),
    ('celebration-ring-005','https://upload.meeshosupplyassets.com/cataloging/1791402530003/CelebrationRinginBloom.png','Korean Floral Petal Adjustable Ring'),
    ('celebration-ring-006','https://upload.meeshosupplyassets.com/cataloging/1791402529989/CelebrationRing_ABrighterYou.png','Korean Minimal Crest Adjustable Ring'),
    ('celebration-ring-007','https://upload.meeshosupplyassets.com/cataloging/1791402529991/CelebrationRing_ARomanticSurprise.png','Korean Love Curve Adjustable Ring'),
    ('celebration-ring-008','https://upload.meeshosupplyassets.com/cataloging/1791402529567/CelebrationRing_TimelessSparkle.png','Korean Minimal Beam Adjustable Ring'),
    ('celebration-ring-009','https://upload.meeshosupplyassets.com/cataloging/1791402529886/ChatGPTImageOct8202601_01_02AM.png','Korean Crossline Geometric Adjustable Ring'),
    ('celebration-ring-010','https://upload.meeshosupplyassets.com/cataloging/1791402529835/ChatGPTImageOct8202601_04_02AM.png','Korean Sculpted Loop Adjustable Ring'),
    ('celebration-ring-011','https://upload.meeshosupplyassets.com/cataloging/1791402529908/ElegantHeartRingCelebrationAd.png','Korean Heartline Adjustable Ring'),
    ('celebration-ring-012','https://upload.meeshosupplyassets.com/cataloging/1791402529574/RomanticSilverBypassRinginSatinGlow.png','Korean Bypass Adjustable Ring')
),
transformed AS (
  SELECT cc.id,
         jsonb_set(
           cc.payload,
           '{products}',
           COALESCE((
             SELECT jsonb_agg(
               CASE
                 WHEN c.product_id IS NULL THEN p.product
                 ELSE jsonb_set(
                        jsonb_set(
                          p.product,
                          '{name}',
                          to_jsonb(c.product_name),
                          true
                        ),
                        '{images}',
                        CASE
                          WHEN jsonb_typeof(p.product->'images') = 'array' THEN (
                            SELECT jsonb_agg(
                              jsonb_set(img.value, '{alt}', to_jsonb(c.product_name), true)
                              ORDER BY img.ordinality
                            )
                            FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS img(value, ordinality)
                          )
                          ELSE COALESCE(p.product->'images', '[]'::jsonb)
                        END,
                        true
                      )
               END
               ORDER BY p.ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb))
                  WITH ORDINALITY AS p(product, ordinality)
             LEFT JOIN canonical c ON c.product_id = p.product->>'id'
             WHERE NOT EXISTS (
               SELECT 1
               FROM canonical d
               WHERE d.image_url = COALESCE(
                 p.product->>'imageUrl',
                 p.product->'images'->0->>'url'
               )
               AND p.product->>'id' <> d.product_id
             )
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

DELETE FROM catalog_drafts WHERE id = 'primary';
