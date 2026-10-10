-- Source-evidenced, name-only repair for known Celebration image/name mismatches.
-- User-supplied master workbook 2026-10-10; all 27 original media URLs
-- checked against exact SHA-mapped R2 source records before creating this file.
-- NEVER move images between SKUs, alter prices/stock, or overwrite a manual
-- admin rename/photo. Full transactional, idempotent and revision-recorded.
CREATE TEMP TABLE _celebration_name_repair (
  sku text PRIMARY KEY,
  expected_image_url text NOT NULL,
  previous_name text NOT NULL,
  corrected_name text NOT NULL,
  corrected_description text NOT NULL,
  master_record_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO _celebration_name_repair
 (sku,expected_image_url,previous_name,corrected_name,corrected_description,master_record_id)
VALUES
  ('celebration-set-001', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F92fc2539eec92ffcb35bd64d0a69bc6cf368ffe8dde211c1bb19796a144e1eb4%2Fmain.webp', 'Korean Pearl Halo Crystal Necklace & Earrings Set', 'Black Crystal Cat Necklace & Earrings Set', 'Bold black crystal cat necklace with JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set designed for trendy casual, party and gifting use.', 'CEL-MASTER-0172'),
  ('celebration-set-002', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F102d4651fd067469b21481fd60497fb92618571694535afc035bad3266c3ea4e%2Fmain.webp', 'Korean Cute Teddy Bear Crystal Necklace & Earrings Set', 'Blue Heart Butterfly JD Stone Necklace & Earrings Set', 'Premium blue-heart butterfly necklace with sparkling JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set made for statement party and gifting looks.', 'CEL-MASTER-0167'),
  ('celebration-set-003', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F455286b8989b6cf4fe0d933fc3658d54e04c4e273bc89c1aa080d59f86f8990e%2Fmain.webp', 'Snap Ghost Crystal Necklace & Earrings Set', 'Dolphin Halo JD Stone Necklace & Earrings Set', 'Stylish dolphin halo necklace with crystal/JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set with a bright polished silver finish.', 'CEL-MASTER-0168'),
  ('celebration-set-004', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F0cfd2fed5393de75dc3180a275b50f15b7f79cc8db5020f2cd223114ba1e2573%2Fmain.webp', 'Korean Blue Heart Butterfly Necklace & Earrings Set', 'Crystal Cat Teardrop Necklace & Earrings Set', 'Trending crystal cat/owlish pendant necklace with a clear teardrop stone and matching pearl-style earrings. Imported anti-tarnish complete set with statement sparkle.', 'CEL-MASTER-0177'),
  ('celebration-set-005', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fd3b49f5f71956b315d4622778b89de829c857dd815ecfbaa5c3bbad5d6677b65%2Fmain.webp', 'Korean Dolphin Crystal Necklace & Earrings Set', 'Oval Pearl Halo JD Stone Necklace & Earrings Set', 'Premium oval pearl-centre halo necklace with sparkling JD stone detailing and matching pearl-style earrings. Imported anti-tarnish finish for a polished everyday and occasion-ready complete set.', 'CEL-MASTER-0164'),
  ('celebration-set-006', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F6f48b4e5bf3a52d93eee9d95df3282844d60c5d02d44bf2548b4fb37e0c28f45%2Fmain.webp', 'Korean Trinity Heart Pearl Necklace & Earrings Set', 'Crystal Ghost JD Stone Necklace & Earrings Set', 'Trending crystal ghost pendant necklace fully studded with JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set with a playful premium look.', 'CEL-MASTER-0166'),
  ('celebration-set-007', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fa09b1f5c7ef3fe672053afd804e4b4908d65b9eab500e0895fd4e5db4eb70fef%2Fmain.webp', 'Korean Pink Love Crystal Necklace & Earrings Set', 'Eiffel Tower Pearl Necklace & Earrings Set', 'Premium Eiffel Tower pearl medallion necklace with a crystal/JD stone border and matching pearl-style earrings. Imported anti-tarnish complete set with travel-inspired elegance.', 'CEL-MASTER-0178'),
  ('celebration-set-008', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F38820d2c65fe90f6e8f71eecf813a761891b6037c9ccd1adcc7880c25e8d0fbb%2Fmain.webp', 'Korean Mother-of-Pearl Bar Necklace & Earrings Set', 'Mother-of-Pearl Dolphin Necklace & Earrings Set', 'Premium dolphin necklace with mother-of-pearl style inlay, JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set with elegant shine.', 'CEL-MASTER-0173'),
  ('celebration-set-009', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F00745f08b6cc22eed5890e197ab129c19753601279fb1bb8ced422007715e365%2Fmain.webp', 'Korean Black Cat Crystal Necklace & Earrings Set', 'Trinity Heart Pearl JD Stone Necklace & Earrings Set', 'Elegant trinity-heart pearl necklace with JD stone accents and matching pearl-style earrings. Imported anti-tarnish complete set with a refined premium finish for parties and gifting.', 'CEL-MASTER-0169'),
  ('celebration-set-010', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F4035045affcbc4cf0baf2073a2fae5b3ec5bdc37e0f9117f8e0b2a38fab5d369%2Fmain.webp', 'Korean Mother-of-Pearl Dolphin Necklace & Earrings Set', 'Black Butterfly JD Stone Necklace & Earrings Set', 'Trending black butterfly necklace with sparkling JD stone detailing and matching pearl-style earrings. Imported anti-tarnish complete set with a compact premium fashion look.', 'CEL-MASTER-0174'),
  ('celebration-set-011', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F0b89b9919600bb73486bb4e6b687232e245dae30c8c706cfe5bc69928e657e66%2Fmain.webp', 'Korean Black Butterfly Crystal Necklace & Earrings Set', 'Butterfly Pearl Drop Necklace & Earrings Set', 'Premium butterfly necklace with a pearl-style drop, fully studded JD stone wings and matching pearl-style earrings. Imported anti-tarnish complete set with long-lasting shine.', 'CEL-MASTER-0176'),
  ('celebration-set-012', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ff154dea196cbfd281739ca9d318db61d591bd2dbf09301116cfec8a3222ae055%2Fmain.webp', 'Korean Pearl Crescent Crystal Necklace & Earrings Set', 'Double Heart Pearl Necklace & Earrings Set', 'Elegant double-heart pearl necklace with bright JD stone accents and matching pearl-style earrings. Imported anti-tarnish complete set designed for gifting, parties and daily styling.', 'CEL-MASTER-0165'),
  ('celebration-set-013', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F61c604b612f94302cfa1379d4edd25b1459abb17ff2d259952309e3cfe16e18d%2Fmain.webp', 'Korean Butterfly Pearl Drop Necklace & Earrings Set', 'Pearl Bar Rectangle Necklace & Earrings Set', 'Modern rectangular pearl-inlay bar necklace with a JD stone accent row and matching pearl-style earrings. Imported anti-tarnish complete set with a clean premium look.', 'CEL-MASTER-0171'),
  ('celebration-set-014', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fc76099f8a37f799b5a6a5096402662ec5123b34bb3caaa3cc2769de60534c509%2Fmain.webp', 'Korean Blue-Eye Cat Crystal Necklace & Earrings Set', 'Pearl Crescent Halo Necklace & Earrings Set', 'Elegant pearl crescent halo necklace surrounded by sparkling JD stones with matching pearl-style earrings. Imported anti-tarnish complete set for timeless party and gifting wear.', 'CEL-MASTER-0175'),
  ('celebration-set-015', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F4adce917104bb6169b6d385d33e99743583e142f2a6dfb91203475105fe01c48%2Fmain.webp', 'Korean Eiffel Tower Pearl Necklace & Earrings Set', 'Pink Crystal Double Heart Necklace & Earrings Set', 'Trending double-heart necklace with a pink centre stone, sparkling JD detailing and matching pearl-style earrings. Imported anti-tarnish complete set for premium fashion styling.', 'CEL-MASTER-0170'),
  ('celebration-bangle-001', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ff907544735e7237594395f0d280976ffc89101203f862752b443c9e1e828509e%2Fmain.webp', 'Korean Contemporary Open Cuff Gold Bracelet', 'Celebration Auric Festive Cuff Bracelet', 'Contemporary gold-plated open cuff bracelet with an adjustable fit and polished imported finish for festive and western styling.', 'CEL-MASTER-0052'),
  ('celebration-bangle-002', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F00d460b3f90ea00b173b8ea94884272fdfe78f5b3efceddb603772d5c3db9bfb%2Fmain.webp', 'Korean Daisy Flower Gold Bangle', 'Celebration Daisy Bloom Gold Bangle', 'Floral daisy-style gold-plated bangle with artificial stone detailing, adjustable sizing and a polished party-wear finish.', 'CEL-MASTER-0053'),
  ('celebration-bangle-003', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ffa248d80baae04c4155f8ca6684960b66b03ae23af198c3e5658760a69c8af05%2Fmain.webp', 'Korean Evil Eye Nazar Gold Bracelet', 'Celebration Nazar Eye Gold Bracelet', 'Gold-plated evil-eye nazar bracelet with artificial stone detailing and adjustable sizing for everyday and gifting wear.', 'CEL-MASTER-0054'),
  ('celebration-bangle-004', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F93853389a11173cb8b015d71ae7c6de9dd6a24235678a4c086798bcbfb1a0d3a%2Fmain.webp', 'Korean Filigree Ridge Gold Bangle', 'Celebration Regal Ridge Gold Bangle', 'Gold-plated filigree-style bangle with a ridged decorative pattern and adjustable fit for festive and western party styling.', 'CEL-MASTER-0055'),
  ('celebration-bangle-005', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F31991808478955c224412c539898d70f73ca8f9782c56975438d044a420e3615%2Fmain.webp', 'Korean Geometric Line Gold Bangle', 'Celebration Halo Line Gold Bangle', 'Minimal geometric line gold-plated bangle with a clean contemporary silhouette and adjustable sizing.', 'CEL-MASTER-0056'),
  ('celebration-bangle-006', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F564abe34aa24cb501701fd59d6e1e6c8850f9782f3902d8897898b6a7ea40e67%2Fmain.webp', 'Korean Sculpted Open Cuff Gold Bracelet', 'Celebration Sculpted Arc Gold Cuff', 'Sculpted gold-plated open cuff bracelet with a hand-crafted look, adjustable sizing and polished imported finish.', 'CEL-MASTER-0057'),
  ('celebration-bangle-007', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fb0e9ab9040b43531fb192e2fcb2edc28c3824712b4da4adf1b2858c8e128a993%2Fmain.webp', 'Korean Minimal Curve Gold Bangle', 'Celebration Signature Curve Gold Bangle', 'Contemporary curved gold-plated bangle with a minimal polished profile and adjustable fit for daily or party wear.', 'CEL-MASTER-0058'),
  ('celebration-bangle-008', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F658238b069d6d3b8033696f6d7c648bedd54a2c0261bf870f35565ace8d3483c%2Fmain.webp', 'Korean Chain Link Gold Bracelet', 'Celebration Classic Link Gold Bracelet', 'Gold-plated chain-link bracelet with a classic linked design, adjustable sizing and versatile western-party styling.', 'CEL-MASTER-0059'),
  ('celebration-bangle-009', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fe68a4edec2540772c67c67e92b3947e74221e65b1fe659a7843eef9a2f83f039%2Fmain.webp', 'Korean Heart Charm Gold Bangle', 'Celebration Amour Heart Gold Bangle', 'Heart-motif gold-plated bangle with an adjustable fit and polished romantic styling for gifting and party wear.', 'CEL-MASTER-0060'),
  ('celebration-bangle-010', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fadcdb8b12a35b916ebf58fee848db44825e9e809e2de060bdb4307212861debe%2Fmain.webp', 'Korean Serpent Twist Gold Bangle', 'Celebration Serpent Twist Gold Bangle', 'Serpent-inspired twist gold-plated bangle with a contemporary statement profile and adjustable sizing.', 'CEL-MASTER-0061'),
  ('celebration-bangle-011', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ff7550fedf8b1983980e6b4645e37fac8b61530614d5ff37d0bbe905086e34037%2Fmain.webp', 'Korean Square Geometric Gold Bangle', 'Celebration Geo Square Gold Bangle', 'Square geometric gold-plated bangle with an adjustable fit and bold modern styling for western and festive looks.', 'CEL-MASTER-0062'),
  ('celebration-bangle-012', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fc085fe8664f3da37c9549bcb4f4d797e7ca601794b49d1dd3ce21e2c22fe0a68%2Fmain.webp', 'Korean Butterfly Charm Gold Bangle', 'Celebration Wing Charm Gold Bangle', 'Butterfly-motif gold-plated bangle with artificial stone detailing, adjustable sizing and a polished feminine finish.', 'CEL-MASTER-0063');

DO $repair$
DECLARE
  original_payload jsonb;
  original_version integer;
  repaired_items jsonb;
  adjusted int;
  draft_record record;
  draft_items jsonb;
  draft_adjusted int;
  new_version integer;
BEGIN
  SELECT payload, version INTO original_payload, original_version
    FROM catalog_config WHERE id = 'primary' FOR UPDATE;
  IF original_payload IS NULL THEN
    RAISE NOTICE 'No initialized live catalog: correct seed is applied at first initialization.';
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(
      CASE WHEN m.sku IS NOT NULL
          AND p.product->>'name'=m.previous_name
          AND p.product->>'imageUrl'=m.expected_image_url
          AND p.product->'images'->0->>'url'=m.expected_image_url
        THEN jsonb_set(
          jsonb_set(
            jsonb_set(p.product,'{name}',to_jsonb(m.corrected_name),true),
            '{description}',to_jsonb(m.corrected_description),true
          ),
          '{images}',COALESCE((
            SELECT jsonb_agg(
              CASE WHEN im.value->>'alt'=m.previous_name
                THEN jsonb_set(im.value,'{alt}',to_jsonb(m.corrected_name),true)
                ELSE im.value END ORDER BY im.ordinality
            )
            FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS im(value,ordinality)
          ), '[]'::jsonb),true)
        ELSE p.product END ORDER BY p.ordinality
    ),'[]'::jsonb),
    COALESCE(count(*) FILTER (WHERE m.sku IS NOT NULL
       AND p.product->>'name'=m.previous_name
       AND p.product->>'imageUrl'=m.expected_image_url
       AND p.product->'images'->0->>'url'=m.expected_image_url),0)::int
  INTO repaired_items, adjusted
  FROM jsonb_array_elements(COALESCE(original_payload->'products','[]'::jsonb)) WITH ORDINALITY p(product,ordinality)
  LEFT JOIN _celebration_name_repair m ON m.sku=p.product->>'id';

  IF adjusted = 0 THEN
    RAISE NOTICE 'Catalog product titles: 0 eligible original source/name pairs changed. Manual edits left intact.';
    RETURN;
  END IF;

  UPDATE catalog_config
    SET payload=jsonb_set(original_payload,'{products}',repaired_items,true),
        version=original_version+1, updated_at=now()
    WHERE id='primary' AND version=original_version
    RETURNING version INTO new_version;
  IF new_version IS NULL THEN RAISE EXCEPTION 'Catalog concurrently modified'; END IF;

  INSERT INTO catalog_revisions(version,payload)
   SELECT version,payload FROM catalog_config WHERE id='primary';

  -- Preserve any admin's work in progress; patch ONLY still-matching source
  -- records. Rebase the draft if it was current, leave stale drafts stale.
  FOR draft_record IN
    SELECT id,payload,base_version FROM catalog_drafts WHERE id='primary' FOR UPDATE
  LOOP
    SELECT COALESCE(jsonb_agg(
        CASE WHEN m.sku IS NOT NULL
          AND p.product->>'name'=m.previous_name
          AND p.product->>'imageUrl'=m.expected_image_url
          AND p.product->'images'->0->>'url'=m.expected_image_url
          THEN jsonb_set(
            jsonb_set(
              jsonb_set(p.product,'{name}',to_jsonb(m.corrected_name),true),
              '{description}',to_jsonb(m.corrected_description),true),
            '{images}',COALESCE((
              SELECT jsonb_agg(
                CASE WHEN im.value->>'alt'=m.previous_name
                THEN jsonb_set(im.value,'{alt}',to_jsonb(m.corrected_name),true)
                ELSE im.value END ORDER BY im.ordinality
              )
              FROM jsonb_array_elements(p.product->'images') WITH ORDINALITY AS im(value,ordinality)
            ),'[]'::jsonb),true)
          ELSE p.product END ORDER BY p.ordinality
      ),'[]'::jsonb),
      COALESCE(count(*) FILTER (WHERE m.sku IS NOT NULL
        AND p.product->>'name'=m.previous_name
        AND p.product->>'imageUrl'=m.expected_image_url
        AND p.product->'images'->0->>'url'=m.expected_image_url),0)::int
    INTO draft_items,draft_adjusted
    FROM jsonb_array_elements(COALESCE(draft_record.payload->'products','[]'::jsonb)) WITH ORDINALITY p(product,ordinality)
    LEFT JOIN _celebration_name_repair m ON m.sku=p.product->>'id';

    UPDATE catalog_drafts
      SET payload=CASE WHEN draft_adjusted>0 THEN jsonb_set(draft_record.payload,'{products}',draft_items,true) ELSE draft_record.payload END,
          base_version=CASE WHEN draft_record.base_version=original_version THEN new_version ELSE draft_record.base_version END,
          updated_at=now()
      WHERE id=draft_record.id;
  END LOOP;

  RAISE NOTICE 'Catalog name repair: updated % exact-SKU/source matches out of 27 references; others retained for review.', adjusted;
END $repair$;
