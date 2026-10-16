-- Owner-confirmed name-only corrections from Celebration's 2026-10-16 visual review.
-- 89 products reviewed: 29 requested names, 60 confirmed unchanged.
-- Preserve exact owner-entered spelling, SKU-to-photo ownership, inventory, price, order and media fields.
-- Apply only when existing live title and BOTH hero/gallery image URL match the reviewed source.
-- Transactional via scripts/migrate.mjs. Changes recorded as a new catalog revision.

CREATE TEMP TABLE _celebration_owner_name_review_20261016 (
  sku text PRIMARY KEY,
  expected_image_url text NOT NULL,
  previous_name text NOT NULL,
  corrected_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO _celebration_owner_name_review_20261016
 (sku,expected_image_url,previous_name,corrected_name)
VALUES
  ('celebration-necklace-007', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-007.png', 'Korean Crown Dancing Stone Necklace', 'korean trending circle flower Dancing Stone Necklace'),
  ('celebration-necklace-008', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-008.png', 'Korean Teardrop Dancing Stone Necklace', 'Korean Crown Dancing Stone Necklace'),
  ('celebration-necklace-009', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-009.png', 'Korean Heart Dancing Stone Necklace', 'Korean ovel Dancing Stone Necklace'),
  ('celebration-necklace-010', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-010.png', 'Korean Wave Dancing Stone Necklace', 'Korean thrist 01 Dancing Stone Necklace'),
  ('celebration-necklace-011', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-011.png', 'Korean Gold Flower Dancing Stone Necklace', 'korean trending  thirst dancing stone necklace'),
  ('celebration-necklace-012', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-012.png', 'Korean Teddy Bear Dancing Stone Necklace', 'Korean Gold Flower Dancing Stone Necklace'),
  ('celebration-necklace-013', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-013.png', 'Korean Flower Dancing Stone Necklace', 'Korean Teddy Bear Dancing Stone Necklace'),
  ('celebration-necklace-014', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-014.png', 'Korean Moon Heart Dancing Stone Necklace', 'Korean snowflake moving stone  Pendant Necklace'),
  ('celebration-necklace-015', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-015.png', 'Korean Pearl Flower Pendant Necklace', 'Korean Moon Heart Dancing Stone Necklace'),
  ('celebration-necklace-016', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-016.png', 'Korean Rose Gold Teddy Bear Crystal Necklace', 'korean teddy dancing stone necklace'),
  ('celebration-necklace-017', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-017.png', 'Korean Gold Flower Medallion Necklace', 'Korean Rose Gold Teddy Bear Crystal Necklace'),
  ('celebration-necklace-018', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-018.png', 'Korean Open Flower Crystal Pendant Necklace', 'Korean Open  rotating Flower spiner Crystal Pendant Necklace'),
  ('celebration-necklace-021', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-021.png', 'Korean Spiral Flower Crystal Necklace', 'Korean star and heart Flower Crystal Necklace'),
  ('celebration-set-001', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F92fc2539eec92ffcb35bd64d0a69bc6cf368ffe8dde211c1bb19796a144e1eb4%2Fmain.webp', 'Black Crystal Cat Necklace & Earrings Set', 'korean pearl and Crystal Necklace & Earrings Set'),
  ('celebration-set-002', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F102d4651fd067469b21481fd60497fb92618571694535afc035bad3266c3ea4e%2Fmain.webp', 'Blue Heart Butterfly JD Stone Necklace & Earrings Set', 'korean pure white beautiful heart and crystal necklace and earing set'),
  ('celebration-set-003', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F455286b8989b6cf4fe0d933fc3658d54e04c4e273bc89c1aa080d59f86f8990e%2Fmain.webp', 'Dolphin Halo JD Stone Necklace & Earrings Set', 'Crystal Ghost JD Stone Necklace & Earrings Set'),
  ('celebration-set-004', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F0cfd2fed5393de75dc3180a275b50f15b7f79cc8db5020f2cd223114ba1e2573%2Fmain.webp', 'Crystal Cat Teardrop Necklace & Earrings Set', 'Blue Heart Butterfly JD Stone Necklace & Earrings Set'),
  ('celebration-set-005', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fd3b49f5f71956b315d4622778b89de829c857dd815ecfbaa5c3bbad5d6677b65%2Fmain.webp', 'Oval Pearl Halo JD Stone Necklace & Earrings Set', 'Dolphin Halo JD Stone Necklace & Earrings Set'),
  ('celebration-set-006', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F6f48b4e5bf3a52d93eee9d95df3282844d60c5d02d44bf2548b4fb37e0c28f45%2Fmain.webp', 'Crystal Ghost JD Stone Necklace & Earrings Set', 'Trinity Heart Pearl JD Stone Necklace & Earrings Set'),
  ('celebration-set-007', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fa09b1f5c7ef3fe672053afd804e4b4908d65b9eab500e0895fd4e5db4eb70fef%2Fmain.webp', 'Eiffel Tower Pearl Necklace & Earrings Set', 'Pink Crystal Heart teedy Necklace & Earrings Set'),
  ('celebration-set-008', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F38820d2c65fe90f6e8f71eecf813a761891b6037c9ccd1adcc7880c25e8d0fbb%2Fmain.webp', 'Mother-of-Pearl Dolphin Necklace & Earrings Set', 'Pearl Bar Rectangle Necklace & Earrings Set'),
  ('celebration-set-009', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F00745f08b6cc22eed5890e197ab129c19753601279fb1bb8ced422007715e365%2Fmain.webp', 'Trinity Heart Pearl JD Stone Necklace & Earrings Set', 'korean pearl cat(black)  jd stone earing and necklace set'),
  ('celebration-set-010', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F4035045affcbc4cf0baf2073a2fae5b3ec5bdc37e0f9117f8e0b2a38fab5d369%2Fmain.webp', 'Black Butterfly JD Stone Necklace & Earrings Set', 'Mother-of-Pearl Dolphin Necklace & Earrings Set'),
  ('celebration-set-011', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F0b89b9919600bb73486bb4e6b687232e245dae30c8c706cfe5bc69928e657e66%2Fmain.webp', 'Butterfly Pearl Drop Necklace & Earrings Set', 'dual butterfly black and crystal necklace and earing set'),
  ('celebration-set-012', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ff154dea196cbfd281739ca9d318db61d591bd2dbf09301116cfec8a3222ae055%2Fmain.webp', 'Double Heart Pearl Necklace & Earrings Set', 'Pearl Crescent Halo Necklace & Earrings Set'),
  ('celebration-set-013', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F61c604b612f94302cfa1379d4edd25b1459abb17ff2d259952309e3cfe16e18d%2Fmain.webp', 'Pearl Bar Rectangle Necklace & Earrings Set', 'Butterfly Pearl Drop Necklace & Earrings Set'),
  ('celebration-set-014', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fc76099f8a37f799b5a6a5096402662ec5123b34bb3caaa3cc2769de60534c509%2Fmain.webp', 'Pearl Crescent Halo Necklace & Earrings Set', 'korean pearl cat jd  stone necklace and ezring set'),
  ('celebration-set-015', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F4adce917104bb6169b6d385d33e99743583e142f2a6dfb91203475105fe01c48%2Fmain.webp', 'Pink Crystal Double Heart Necklace & Earrings Set', 'Eiffel Tower Pearl Necklace & Earrings Set'),
  ('celebration-bangle-003', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ffa248d80baae04c4155f8ca6684960b66b03ae23af198c3e5658760a69c8af05%2Fmain.webp', 'Celebration Nazar Eye Gold Bracelet', 'Celebration evil Eye Gold Bracelet');

DO $rename$
DECLARE
  original_payload jsonb;
  original_version int;
  changed_products jsonb;
  changed_count int;
  resulting_version int;
  draft_record record;
  draft_products jsonb;
  draft_changed int;
BEGIN
  SELECT payload, version INTO original_payload, original_version
    FROM catalog_config WHERE id = 'primary' FOR UPDATE;
  IF original_payload IS NULL THEN
    RAISE NOTICE 'Owner name review: live catalog missing. Migration made no changes.';
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(
    CASE WHEN m.sku IS NOT NULL
      AND p.product->>'name' = m.previous_name
      AND p.product->>'imageUrl' = m.expected_image_url
      AND p.product->'images'->0->>'url' = m.expected_image_url
    THEN jsonb_set(
      jsonb_set(p.product, '{name}', to_jsonb(m.corrected_name), true),
      '{images}',
      (SELECT jsonb_agg(
         CASE WHEN img.value->>'alt' = m.previous_name
            THEN jsonb_set(img.value, '{alt}', to_jsonb(m.corrected_name), true)
            ELSE img.value END
         ORDER BY img.ordinality)
       FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS img(value, ordinality)),
      true)
    ELSE p.product END
    ORDER BY p.ordinality), '[]'::jsonb),
    count(*) FILTER (WHERE m.sku IS NOT NULL
      AND p.product->>'name' = m.previous_name
      AND p.product->>'imageUrl' = m.expected_image_url
      AND p.product->'images'->0->>'url' = m.expected_image_url)::int
   INTO changed_products, changed_count
   FROM jsonb_array_elements(COALESCE(original_payload->'products','[]'::jsonb))
        WITH ORDINALITY AS p(product, ordinality)
   LEFT JOIN _celebration_owner_name_review_20261016 m ON m.sku = p.product->>'id';

  IF changed_count = 0 THEN
    RAISE NOTICE 'Owner name review: no unchanged expected-name/photo records; skipped.';
    RETURN;
  END IF;

  UPDATE catalog_config
     SET payload = jsonb_set(original_payload, '{products}', changed_products, true),
         version = original_version + 1, updated_at = now()
   WHERE id = 'primary' AND version = original_version
   RETURNING version INTO resulting_version;
  IF resulting_version IS NULL THEN RAISE EXCEPTION 'Owner name review: version conflict'; END IF;

  INSERT INTO catalog_revisions(version,payload)
    SELECT version,payload FROM catalog_config WHERE id = 'primary';

  -- Preserve an in-progress admin draft. Only rebase a draft built on the
  -- current live version, and only correct exact unmodified name+photo pairs.
  FOR draft_record IN
    SELECT id,payload,base_version FROM catalog_drafts WHERE id='primary' FOR UPDATE
  LOOP
    IF draft_record.base_version = original_version THEN
      SELECT COALESCE(jsonb_agg(
        CASE WHEN m.sku IS NOT NULL
          AND p.product->>'name' = m.previous_name
          AND p.product->>'imageUrl' = m.expected_image_url
          AND p.product->'images'->0->>'url' = m.expected_image_url
        THEN jsonb_set(
          jsonb_set(p.product, '{name}', to_jsonb(m.corrected_name), true),
          '{images}',
          (SELECT jsonb_agg(
             CASE WHEN img.value->>'alt' = m.previous_name
               THEN jsonb_set(img.value, '{alt}', to_jsonb(m.corrected_name), true)
               ELSE img.value END
             ORDER BY img.ordinality)
           FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS img(value,ordinality)),
          true)
        ELSE p.product END ORDER BY p.ordinality), '[]'::jsonb),
        count(*) FILTER (WHERE m.sku IS NOT NULL
          AND p.product->>'name' = m.previous_name
          AND p.product->>'imageUrl' = m.expected_image_url
          AND p.product->'images'->0->>'url' = m.expected_image_url)::int
      INTO draft_products, draft_changed
      FROM jsonb_array_elements(COALESCE(draft_record.payload->'products','[]'::jsonb))
           WITH ORDINALITY AS p(product, ordinality)
      LEFT JOIN _celebration_owner_name_review_20261016 m ON m.sku=p.product->>'id';

      UPDATE catalog_drafts
         SET payload=CASE WHEN draft_changed > 0
                           THEN jsonb_set(draft_record.payload, '{products}', draft_products, true)
                           ELSE draft_record.payload END,
             base_version=resulting_version, updated_at=now()
       WHERE id=draft_record.id;
      RAISE NOTICE 'Owner name review: rebased current admin draft; % names patched.', draft_changed;
    ELSE
      RAISE NOTICE 'Owner name review: stale admin draft left untouched.';
    END IF;
  END LOOP;

  RAISE NOTICE 'Owner name review: updated %/29 eligible product titles; images preserved.', changed_count;
END $rename$;
