-- Correct Celebration ring image mapping from the latest workbook and keep neutral product names.
WITH canonical(product_id, image_url, product_name) AS (
  VALUES
    ('celebration-ring-001','https://upload.meeshosupplyassets.com/cataloging/1791406449025/CelebrationCrownRingJewelryAdvertisement.png','Korean Crown Adjustable Ring'),
    ('celebration-ring-002','https://upload.meeshosupplyassets.com/cataloging/1791406448940/CelebrationDouble-HeartRingAdvertisement.png','Korean Twin Heart Bypass Adjustable Ring'),
    ('celebration-ring-003','https://upload.meeshosupplyassets.com/cataloging/1791406448989/CelebrationHeartRingGiftBanner.png','Korean Open Heart Adjustable Ring'),
    ('celebration-ring-004','https://upload.meeshosupplyassets.com/cataloging/1791406449137/CelebrationRingFestiveJewelryAd.png','Korean Geometric Arc Adjustable Ring'),
    ('celebration-ring-005','https://upload.meeshosupplyassets.com/cataloging/1791406449145/CelebrationRinginBloom.png','Korean Floral Petal Adjustable Ring'),
    ('celebration-ring-006','https://upload.meeshosupplyassets.com/cataloging/1791406449146/CelebrationRing_ABrighterYou.png','Korean Minimal Crest Adjustable Ring'),
    ('celebration-ring-007','https://upload.meeshosupplyassets.com/cataloging/1791406449171/CelebrationRing_ARomanticSurprise.png','Korean Love Curve Adjustable Ring'),
    ('celebration-ring-008','https://upload.meeshosupplyassets.com/cataloging/1791406449034/CelebrationRing_TimelessSparkle.png','Korean Minimal Beam Adjustable Ring'),
    ('celebration-ring-009','https://upload.meeshosupplyassets.com/cataloging/1791406449135/ChatGPTImageOct8202601_01_02AM.png','Korean Crossline Geometric Adjustable Ring'),
    ('celebration-ring-010','https://upload.meeshosupplyassets.com/cataloging/1791406449091/ChatGPTImageOct8202601_04_02AM.png','Korean Sculpted Loop Adjustable Ring'),
    ('celebration-ring-011','https://upload.meeshosupplyassets.com/cataloging/1791406449075/ElegantHeartRingCelebrationAd.png','Korean Heartline Adjustable Ring'),
    ('celebration-ring-012','https://upload.meeshosupplyassets.com/cataloging/1791406449011/RomanticCelebrationRingAdvertisement.png','Korean Bypass Adjustable Ring')
), transformed AS (
  SELECT cc.id, jsonb_set(cc.payload, '{products}', (
    SELECT jsonb_agg(CASE WHEN c.product_id IS NULL THEN p.product ELSE
      jsonb_set(jsonb_set(jsonb_set(p.product, '{name}', to_jsonb(c.product_name), true),
        '{imageUrl}', to_jsonb(c.image_url), true),
        '{images}', jsonb_build_array(jsonb_build_object('url', c.image_url, 'alt', c.product_name)), true)
      END ORDER BY p.ordinality)
    FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb)) WITH ORDINALITY AS p(product, ordinality)
    LEFT JOIN canonical c ON c.product_id=p.product->>'id'
  ), true) AS payload
  FROM catalog_config cc WHERE cc.id='primary'
), updated AS (
  UPDATE catalog_config cc SET payload=transformed.payload, version=cc.version+1, updated_at=now()
  FROM transformed WHERE cc.id=transformed.id RETURNING cc.version, cc.payload
)
INSERT INTO catalog_revisions (version, payload) SELECT version, payload FROM updated;
