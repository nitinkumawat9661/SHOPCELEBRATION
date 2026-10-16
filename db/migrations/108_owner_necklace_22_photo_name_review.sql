-- Owner-provided 16-Oct jewelry photo/title decisions; ONLY 11 name corrections.
-- Exact original first-party necklace SKU, image URL, old title, description,
-- and first gallery image/alt MUST still match before any change.
-- No photo swaps, inventory adjustments, price/retail edits, customer data or orders.
-- The deploy/migration runner wraps this entire SQL in a transaction.
CREATE TEMP TABLE _owner_necklace_name_repair (
 sku text PRIMARY KEY,
 expected_photo text NOT NULL,
 old_name text NOT NULL,
 new_name text NOT NULL,
 old_description text NOT NULL,
 new_description text NOT NULL
) ON COMMIT DROP;

INSERT INTO _owner_necklace_name_repair
 (sku,expected_photo,old_name,new_name,old_description,new_description) VALUES
  ('celebration-necklace-007', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-007.png', 'Korean Crown Dancing Stone Necklace', 'Korean Clover Dancing Stone Necklace', 'Crown-sweep necklace with a free-moving central stone, bright JD embellishment and anti-tarnish silver plating for festive wear.', 'Round clover/quatrefoil pendant with a moving centre stone and delicate stone detailing.'),
  ('celebration-necklace-008', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-008.png', 'Korean Teardrop Dancing Stone Necklace', 'Korean Crown Teardrop Dancing Stone Necklace', 'Teardrop-orbit necklace featuring a mobile center stone, sparkling JD accents and a polished anti-tarnish silver-toned surface.', 'Crown- and lotus-inspired teardrop frame with a moving centre stone.'),
  ('celebration-necklace-009', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-009.png', 'Korean Heart Dancing Stone Necklace', 'Korean Bow Teardrop Dancing Stone Necklace', 'Star-and-heart themed necklace with a moving focal stone, fine JD detailing and anti-tarnish finish suited to evening looks.', 'Bow-topped teardrop-loop pendant with a moving centre stone.'),
  ('celebration-necklace-011', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-011.png', 'Korean Gold Flower Dancing Stone Necklace', 'Korean Fan Crystal Pendant Necklace', 'Gold-toned floral orbit necklace with JD stone highlights, anti-tarnish plating and a festive imported-style finish.', 'Fan-shaped pendant in silver- and gold-tone styling with crystal detail.'),
  ('celebration-necklace-012', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-012.png', 'Korean Teddy Bear Dancing Stone Necklace', 'Korean Gold Clover Dancing Stone Necklace', 'Teddy-inspired halo necklace with a moving center stone, bright JD detailing and a smooth anti-tarnish silver finish.', 'Gold-tone clover/quatrefoil pendant with a moving centre stone.'),
  ('celebration-necklace-014', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-014.png', 'Korean Moon Heart Dancing Stone Necklace', 'Korean Snowflake Dancing Stone Necklace', 'Crescent-heart necklace with a free-moving center stone, JD stone accents and polished anti-tarnish silver-toned finish.', 'Snowflake and starburst-style pendant with a moving centre stone.'),
  ('celebration-necklace-015', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-015.png', 'Korean Pearl Flower Pendant Necklace', 'Korean Moon Heart Dancing Stone Necklace', 'Pearl-centered petal necklace accented with JD stones, anti-tarnish silver plating and a soft statement look for casual wear.', 'Crescent moon and heart pendant featuring a moving centre stone.'),
  ('celebration-necklace-016', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-016.png', 'Korean Rose Gold Teddy Bear Crystal Necklace', 'Korean Teddy Bear Dancing Stone Necklace', 'Rose-toned teddy charm necklace with JD stone detailing, anti-tarnish plating and a playful imported fashion finish.', 'Silver-tone teddy-bear pendant with a moving stone set inside its heart detail.'),
  ('celebration-necklace-017', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-017.png', 'Korean Gold Flower Medallion Necklace', 'Korean Rose Gold Teddy Bear Crystal Necklace', 'Gold-toned round petal necklace with sparkling JD stone work, anti-tarnish finish and a clean floral medallion profile.', 'Rose-gold-tone teddy-bear pendant with a heart motif and crystal-style detailing.'),
  ('celebration-necklace-018', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-018.png', 'Korean Open Flower Crystal Pendant Necklace', 'Korean Rotating Flower Crystal Pendant Necklace', 'Open-flower necklace with detailed JD stone petals, anti-tarnish silver plating and a polished finish for party styling.', 'Rotating five-petal flower pendant with crystal-style accents.'),
  ('celebration-necklace-021', 'https://shopcelebration.in/catalog/necklaces/celebration-necklace-021.png', 'Korean Spiral Flower Crystal Necklace', 'Korean Star Heart Dancing Stone Necklace', 'Rotating flower necklace with a movable upper floral section, full JD stone detailing and anti-tarnish silver finish.', 'Star-framed pendant featuring a heart, bow details and a moving centre stone.');

DO $owner_necklace_repair$
DECLARE
 previous_payload jsonb;
 previous_version integer;
 next_products jsonb;
 eligible integer;
 already_done integer;
 next_version integer;
 draft_row record;
 draft_eligible integer;
 draft_products jsonb;
BEGIN
 SELECT payload,version INTO previous_payload,previous_version
   FROM catalog_config WHERE id='primary' FOR UPDATE;
 IF previous_payload IS NULL THEN
   RAISE NOTICE 'Catalog not initialized; corrected catalog seed will be used.';
   RETURN;
 END IF;
 SELECT count(*) INTO eligible
 FROM jsonb_array_elements(previous_payload->'products') AS p(product)
 JOIN _owner_necklace_name_repair m ON m.sku=p.product->>'id'
 WHERE p.product->>'name'=m.old_name
   AND p.product->>'description'=m.old_description
   AND p.product->>'imageUrl'=m.expected_photo
   AND p.product->'images'->0->>'url'=m.expected_photo
   AND p.product->'images'->0->>'alt'=m.old_name;
 SELECT count(*) INTO already_done
 FROM jsonb_array_elements(previous_payload->'products') AS p(product)
 JOIN _owner_necklace_name_repair m ON m.sku=p.product->>'id'
 WHERE p.product->>'name'=m.new_name
   AND p.product->>'description'=m.new_description
   AND p.product->>'imageUrl'=m.expected_photo
   AND p.product->'images'->0->>'url'=m.expected_photo
   AND p.product->'images'->0->>'alt'=m.new_name;
 IF already_done=11 THEN
   RAISE NOTICE 'All 11 owner-approved necklace labels are already current.';
   RETURN;
 END IF;
 IF eligible<>11 THEN
   RAISE EXCEPTION 'OWNER_NECKLACE_ORIGINAL_RECORDS_CHANGED: expected 11, eligible %, already corrected %. No names were changed.', eligible, already_done;
 END IF;

 SELECT jsonb_agg(
   CASE WHEN m.sku IS NOT NULL
     THEN jsonb_set(
       jsonb_set(
         jsonb_set(p.product,'{name}',to_jsonb(m.new_name),true),
         '{description}',to_jsonb(m.new_description),true),
       '{images}',jsonb_set(p.product->'images','{0,alt}',to_jsonb(m.new_name),false),true)
     ELSE p.product END ORDER BY p.ordinality
 ) INTO next_products
 FROM jsonb_array_elements(previous_payload->'products') WITH ORDINALITY p(product,ordinality)
 LEFT JOIN _owner_necklace_name_repair m ON m.sku=p.product->>'id';

 UPDATE catalog_config
 SET payload=jsonb_set(previous_payload,'{products}',next_products,false),
     version=previous_version+1,updated_at=now()
 WHERE id='primary' AND version=previous_version
 RETURNING version INTO next_version;
 IF next_version IS NULL THEN RAISE EXCEPTION 'CATALOG_CONCURRENT_EDIT'; END IF;
 INSERT INTO catalog_revisions(version,payload)
 SELECT version,payload FROM catalog_config WHERE id='primary';

 FOR draft_row IN SELECT id,payload,base_version FROM catalog_drafts
     WHERE id='primary' FOR UPDATE LOOP
   IF draft_row.base_version=previous_version THEN
     SELECT count(*) INTO draft_eligible
       FROM jsonb_array_elements(draft_row.payload->'products') p(product)
       JOIN _owner_necklace_name_repair m ON m.sku=p.product->>'id'
       WHERE p.product->>'name'=m.old_name
         AND p.product->>'description'=m.old_description
         AND p.product->>'imageUrl'=m.expected_photo
         AND p.product->'images'->0->>'url'=m.expected_photo
         AND p.product->'images'->0->>'alt'=m.old_name;
     IF draft_eligible=11 THEN
       SELECT jsonb_agg(
         CASE WHEN m.sku IS NOT NULL
           THEN jsonb_set(
             jsonb_set(jsonb_set(p.product,'{name}',to_jsonb(m.new_name),true),
               '{description}',to_jsonb(m.new_description),true),
             '{images}',jsonb_set(p.product->'images','{0,alt}',to_jsonb(m.new_name),false),true)
           ELSE p.product END ORDER BY p.ordinality)
       INTO draft_products
       FROM jsonb_array_elements(draft_row.payload->'products') WITH ORDINALITY p(product,ordinality)
       LEFT JOIN _owner_necklace_name_repair m ON m.sku=p.product->>'id';
       UPDATE catalog_drafts
       SET payload=jsonb_set(draft_row.payload,'{products}',draft_products,false),
           base_version=next_version,updated_at=now()
       WHERE id=draft_row.id;
     ELSE
       RAISE NOTICE 'Existing admin draft has manual edits in the 11 necklace names; leaving draft unchanged and stale for review.';
     END IF;
   ELSE
     RAISE NOTICE 'Already-stale admin draft preserved unchanged.';
   END IF;
 END LOOP;
 RAISE NOTICE 'Owner confirmed 11 necklace names changed at catalog version %; all photos, prices and stock retained.',next_version;
END $owner_necklace_repair$;
