-- Owner-approved spelling and title case corrections after migration 107.
-- Source: 2026-10-16 owner visual review (89 reviewed / 29 edited / 60 retained).
-- Only apply when SKU, previous title, main image, and gallery image ALL match.
-- Preserve images, prices, stock, descriptions, customer orders, and manual admin edits.
CREATE TEMP TABLE _celebration_copyedit_20261016 (
 sku text PRIMARY KEY,
 expected_image_url text NOT NULL,
 previous_name text NOT NULL,
 corrected_name text NOT NULL
) ON COMMIT DROP;
INSERT INTO _celebration_copyedit_20261016
 (sku,expected_image_url,previous_name,corrected_name) VALUES
  ('celebration-necklace-007', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-007.png', 'korean trending circle flower Dancing Stone Necklace', 'Korean Circular Flower Dancing Stone Necklace'),
  ('celebration-necklace-009', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-009.png', 'Korean ovel Dancing Stone Necklace', 'Korean Oval Dancing Stone Necklace'),
  ('celebration-necklace-010', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-010.png', 'Korean thrist 01 Dancing Stone Necklace', 'Korean Twist 01 Dancing Stone Necklace'),
  ('celebration-necklace-011', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-011.png', 'korean trending  thirst dancing stone necklace', 'Korean Trending Twist Dancing Stone Necklace'),
  ('celebration-necklace-014', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-014.png', 'Korean snowflake moving stone  Pendant Necklace', 'Korean Snowflake Moving Stone Pendant Necklace'),
  ('celebration-necklace-016', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-016.png', 'korean teddy dancing stone necklace', 'Korean Teddy Dancing Stone Necklace'),
  ('celebration-necklace-018', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-018.png', 'Korean Open  rotating Flower spiner Crystal Pendant Necklace', 'Korean Open Flower Spinner Crystal Pendant Necklace'),
  ('celebration-necklace-021', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-021.png', 'Korean star and heart Flower Crystal Necklace', 'Korean Star and Heart Flower Crystal Necklace'),
  ('celebration-set-001', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F92fc2539eec92ffcb35bd64d0a69bc6cf368ffe8dde211c1bb19796a144e1eb4%2Fmain.webp', 'korean pearl and Crystal Necklace & Earrings Set', 'Korean Pearl and Crystal Necklace & Earrings Set'),
  ('celebration-set-002', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F102d4651fd067469b21481fd60497fb92618571694535afc035bad3266c3ea4e%2Fmain.webp', 'korean pure white beautiful heart and crystal necklace and earing set', 'Korean White Heart Crystal Necklace & Earrings Set'),
  ('celebration-set-007', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fa09b1f5c7ef3fe672053afd804e4b4908d65b9eab500e0895fd4e5db4eb70fef%2Fmain.webp', 'Pink Crystal Heart teedy Necklace & Earrings Set', 'Pink Crystal Heart Teddy Necklace & Earrings Set'),
  ('celebration-set-009', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F00745f08b6cc22eed5890e197ab129c19753601279fb1bb8ced422007715e365%2Fmain.webp', 'korean pearl cat(black)  jd stone earing and necklace set', 'Korean Black Cat Pearl JD Stone Necklace & Earrings Set'),
  ('celebration-set-011', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2F0b89b9919600bb73486bb4e6b687232e245dae30c8c706cfe5bc69928e657e66%2Fmain.webp', 'dual butterfly black and crystal necklace and earing set', 'Dual Black and Crystal Butterfly Necklace & Earrings Set'),
  ('celebration-set-014', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Fc76099f8a37f799b5a6a5096402662ec5123b34bb3caaa3cc2769de60534c509%2Fmain.webp', 'korean pearl cat jd  stone necklace and ezring set', 'Korean Pearl Cat JD Stone Necklace & Earrings Set'),
  ('celebration-bangle-003', '/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2Ffa248d80baae04c4155f8ca6684960b66b03ae23af198c3e5658760a69c8af05%2Fmain.webp', 'Celebration evil Eye Gold Bracelet', 'Celebration Evil Eye Gold Bracelet');

DO $copyedit$
DECLARE
 original_payload jsonb;
 original_version integer;
 new_items jsonb;
 changed integer;
 new_version integer;
 d record;
 draft_items jsonb;
 draft_changes integer;
BEGIN
 SELECT payload,version INTO original_payload,original_version
 FROM catalog_config WHERE id='primary' FOR UPDATE;
 IF original_payload IS NULL THEN
  RAISE NOTICE 'Owner copyedit skipped: no live catalog';
  RETURN;
 END IF;
 SELECT COALESCE(jsonb_agg(
   CASE WHEN m.sku IS NOT NULL
     AND p.item->>'name' = m.previous_name
     AND p.item->>'imageUrl' = m.expected_image_url
     AND p.item->'images'->0->>'url' = m.expected_image_url
   THEN jsonb_set(
      jsonb_set(p.item,'{name}',to_jsonb(m.corrected_name),true),
      '{images}', (SELECT jsonb_agg(
        CASE WHEN img.value->>'alt'=m.previous_name THEN
          jsonb_set(img.value,'{alt}',to_jsonb(m.corrected_name),true)
          ELSE img.value END ORDER BY img.ordinality)
         FROM jsonb_array_elements(p.item->'images') WITH ORDINALITY AS img(value,ordinality)), true)
   ELSE p.item END ORDER BY p.ordinality), '[]'::jsonb),
   count(*) FILTER (WHERE m.sku IS NOT NULL
     AND p.item->>'name'=m.previous_name
     AND p.item->>'imageUrl'=m.expected_image_url
     AND p.item->'images'->0->>'url'=m.expected_image_url)::integer
 INTO new_items,changed
 FROM jsonb_array_elements(COALESCE(original_payload->'products','[]'::jsonb))
  WITH ORDINALITY AS p(item,ordinality)
 LEFT JOIN _celebration_copyedit_20261016 m ON m.sku=p.item->>'id';
 IF changed=0 THEN
  RAISE NOTICE 'Owner copyedit: 0 eligible records. No changes.';
  RETURN;
 END IF;
 UPDATE catalog_config
 SET payload=jsonb_set(original_payload,'{products}',new_items,true),
     version=original_version+1, updated_at=now()
 WHERE id='primary' AND version=original_version RETURNING version INTO new_version;
 IF new_version IS NULL THEN RAISE EXCEPTION 'Copyedit conflict'; END IF;
 INSERT INTO catalog_revisions(version,payload)
 SELECT version,payload FROM catalog_config WHERE id='primary';

 -- Preserve admin draft edits and rebase only drafts based on the old live version.
 FOR d IN SELECT id,payload,base_version FROM catalog_drafts WHERE id='primary' FOR UPDATE
 LOOP
  IF d.base_version=original_version THEN
   SELECT COALESCE(jsonb_agg(
     CASE WHEN m.sku IS NOT NULL
       AND p.item->>'name'=m.previous_name
       AND p.item->>'imageUrl'=m.expected_image_url
       AND p.item->'images'->0->>'url'=m.expected_image_url
     THEN jsonb_set(
        jsonb_set(p.item,'{name}',to_jsonb(m.corrected_name),true),
        '{images}', (SELECT jsonb_agg(
           CASE WHEN im.value->>'alt'=m.previous_name
             THEN jsonb_set(im.value,'{alt}',to_jsonb(m.corrected_name),true)
             ELSE im.value END ORDER BY im.ordinality)
          FROM jsonb_array_elements(p.item->'images') WITH ORDINALITY AS im(value,ordinality)), true)
     ELSE p.item END ORDER BY p.ordinality), '[]'::jsonb),
     count(*) FILTER (WHERE m.sku IS NOT NULL
       AND p.item->>'name'=m.previous_name
       AND p.item->>'imageUrl'=m.expected_image_url
       AND p.item->'images'->0->>'url'=m.expected_image_url)::integer
   INTO draft_items,draft_changes
   FROM jsonb_array_elements(COALESCE(d.payload->'products','[]'::jsonb))
     WITH ORDINALITY AS p(item,ordinality)
   LEFT JOIN _celebration_copyedit_20261016 m ON m.sku=p.item->>'id';
   UPDATE catalog_drafts SET
      payload=CASE WHEN draft_changes>0 THEN
         jsonb_set(d.payload,'{products}',draft_items,true) ELSE d.payload END,
      base_version=new_version, updated_at=now()
   WHERE id=d.id;
   RAISE NOTICE 'Owner copyedit draft rebased; % names eligible',draft_changes;
  ELSE
   RAISE NOTICE 'Owner copyedit preserved stale admin draft unchanged';
  END IF;
 END LOOP;
 RAISE NOTICE 'Owner copyedit: % of 15 target titles fixed',changed;
END $copyedit$;
