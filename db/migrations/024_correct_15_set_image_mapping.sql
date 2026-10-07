-- Correct the 15 necklace + earrings set image mappings after matching the original product visuals.
WITH image_map(product_id, image_url) AS (
  VALUES
    ('celebration-set-001', 'https://upload.meeshosupplyassets.com/cataloging/1791355648657/file_0000000071f882119af8262e54fc6150.png'),
    ('celebration-set-002', 'https://upload.meeshosupplyassets.com/cataloging/1791355648751/file_00000000cb288208ae37a241a3cec65d.png'),
    ('celebration-set-003', 'https://upload.meeshosupplyassets.com/cataloging/1791355648715/file_000000003a7c82089b1d8a71f556be86.png'),
    ('celebration-set-004', 'https://upload.meeshosupplyassets.com/cataloging/1791355648805/file_00000000827882088ec82249dbe93503.png'),
    ('celebration-set-005', 'https://upload.meeshosupplyassets.com/cataloging/1791355648534/file_000000000dec8211a51cb80a91856409.png'),
    ('celebration-set-006', 'https://upload.meeshosupplyassets.com/cataloging/1791355648806/file_00000000a5788208a886f2bcb5bbeb68.png'),
    ('celebration-set-007', 'https://upload.meeshosupplyassets.com/cataloging/1791355648807/file_0000000022688208836236582c716b36.png'),
    ('celebration-set-008', 'https://upload.meeshosupplyassets.com/cataloging/1791355648719/file_00000000742c8208be0acf749361ff3e.png'),
    ('celebration-set-009', 'https://upload.meeshosupplyassets.com/cataloging/1791355648793/file_000000005f80820884c5dced069ba239.png'),
    ('celebration-set-010', 'https://upload.meeshosupplyassets.com/cataloging/1791355648810/file_0000000018008208a276f3d01ac77ec1.png'),
    ('celebration-set-011', 'https://upload.meeshosupplyassets.com/cataloging/1791355648721/file_00000000636482088fad0bdb3239f937.png'),
    ('celebration-set-012', 'https://upload.meeshosupplyassets.com/cataloging/1791355648814/file_00000000a2a88208932fe3896cc41bc3.png'),
    ('celebration-set-013', 'https://upload.meeshosupplyassets.com/cataloging/1791355648692/file_000000008cd08208b56d175f0e618107.png'),
    ('celebration-set-014', 'https://upload.meeshosupplyassets.com/cataloging/1791355648557/file_0000000088908208bd84e90c3f89e804.png'),
    ('celebration-set-015', 'https://upload.meeshosupplyassets.com/cataloging/1791355648768/file_000000006f2c82088aa27e145f345295.png')
),
updated AS (
  UPDATE catalog_config cc
     SET payload = jsonb_set(
           cc.payload,
           '{products}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN im.image_url IS NULL THEN p.product
                 ELSE jsonb_set(
                        jsonb_set(p.product,'{imageUrl}',to_jsonb(im.image_url),true),
                        '{images}',
                        jsonb_build_array(jsonb_build_object('url',im.image_url,'alt',p.product->>'name')),
                        true
                      )
               END
               ORDER BY p.ordinality
             )
             FROM jsonb_array_elements(COALESCE(cc.payload->'products','[]'::jsonb))
                  WITH ORDINALITY AS p(product, ordinality)
             LEFT JOIN image_map im ON im.product_id = p.product->>'id'
           ),
           true
         ),
         version = cc.version + 1,
         updated_at = now()
   WHERE cc.id = 'primary'
  RETURNING cc.version, cc.payload
)
INSERT INTO catalog_revisions (version, payload)
SELECT version, payload FROM updated;

DELETE FROM catalog_drafts WHERE id = 'primary';
